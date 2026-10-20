#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri_plugin_dialog::DialogExt;

// Filenames arrive as percent-encoded UTF-8 in an IPC header, keeping the
// binary file contents as raw IPC bytes rather than a huge JSON array.
fn decode_filename(encoded: &str) -> Result<String, String> {
    let mut bytes = Vec::with_capacity(encoded.len());
    let mut source = encoded.bytes();

    while let Some(byte) = source.next() {
        if byte == b'%' {
            let upper = source
                .next()
                .and_then(|value| (value as char).to_digit(16))
                .ok_or("Invalid export filename encoding")?;
            let lower = source
                .next()
                .and_then(|value| (value as char).to_digit(16))
                .ok_or("Invalid export filename encoding")?;
            bytes.push(((upper << 4) | lower) as u8);
        } else {
            bytes.push(byte);
        }
    }

    String::from_utf8(bytes).map_err(|_| "Invalid UTF-8 export filename".to_string())
}

/// Display the Windows Save As dialog for any of the web exporters' Blob files.
/// Tauri executes synchronous commands on a worker thread, which is required
/// by the dialog plugin's blocking_save_file implementation.
#[tauri::command]
fn save_export(window: tauri::Window, request: tauri::ipc::Request<'_>) -> Result<bool, String> {
    let tauri::ipc::InvokeBody::Raw(data) = request.body() else {
        return Err("Expected raw binary export data".into());
    };

    let header = request
        .headers()
        .get("x-file-name")
        .ok_or("Missing export filename")?
        .to_str()
        .map_err(|_| "Invalid export filename header")?;
    let decoded = decode_filename(header)?;
    // The browser supplies a suggested filename, never an output path. A
    // selected filesystem path comes exclusively from the native dialog.
    let name = decoded
        .rsplit(['/', '\\'])
        .next()
        .filter(|value| !value.is_empty() && *value != "." && *value != "..")
        .unwrap_or("export.bin");

    let mut dialog = window
        .dialog()
        .file()
        .set_parent(&window)
        .set_title("Save exported file")
        .set_file_name(name);

    if let Some((_, extension)) = name.rsplit_once('.') {
        if !extension.is_empty()
            && extension.len() <= 10
            && extension.bytes().all(|byte| byte.is_ascii_alphanumeric())
        {
            dialog = dialog.add_filter("Export files", &[extension]);
        }
    }

    let Some(selected) = dialog.blocking_save_file() else {
        return Ok(false); // Cancel: no file is written.
    };
    let path = selected
        .into_path()
        .map_err(|error| format!("Invalid output path: {error}"))?;
    std::fs::write(&path, data)
        .map_err(|error| format!("Could not write {}: {error}", path.display()))?;
    Ok(true)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![save_export])
        .run(tauri::generate_context!())
        .expect("failed to run Gridfinity Layout Tool desktop");
}

#[cfg(test)]
mod tests {
    use super::decode_filename;

    #[test]
    fn decodes_unicode_and_percent_in_download_name() {
        assert_eq!(
            decode_filename("drawer%20%C3%B6l%C3%A7%C3%BC%25.stl").unwrap(),
            "drawer ölçü%.stl"
        );
    }

    #[test]
    fn rejects_invalid_filename_encoding() {
        assert!(decode_filename("bad%XX.stl").is_err());
        assert!(decode_filename("bad%FF.stl").is_err());
    }
}
