use serde::Serialize;
use std::fs;
use regex::Regex;

#[derive(Serialize)]
pub struct Symbol {
    pub name: String,
    pub kind: String, // "function", "class", "variable", "interface"
    pub line: usize,
}

#[tauri::command]
pub fn fs_get_symbols(path: String) -> Result<Vec<Symbol>, String> {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let ext = std::path::Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    let mut symbols = Vec::new();

    // Very simple regex-based symbol extraction
    match ext {
        "rs" => {
            let re_fn = Regex::new(r"fn\s+([a-zA-Z_][a-zA-Z0-9_]*)").unwrap();
            let re_struct = Regex::new(r"struct\s+([a-zA-Z_][a-zA-Z0-9_]*)").unwrap();
            let re_enum = Regex::new(r"enum\s+([a-zA-Z_][a-zA-Z0-9_]*)").unwrap();
            let re_trait = Regex::new(r"trait\s+([a-zA-Z_][a-zA-Z0-9_]*)").unwrap();

            for (i, line) in content.lines().enumerate() {
                if let Some(cap) = re_fn.captures(line) {
                    symbols.push(Symbol { name: cap[1].to_string(), kind: "function".to_string(), line: i + 1 });
                } else if let Some(cap) = re_struct.captures(line) {
                    symbols.push(Symbol { name: cap[1].to_string(), kind: "class".to_string(), line: i + 1 });
                } else if let Some(cap) = re_enum.captures(line) {
                    symbols.push(Symbol { name: cap[1].to_string(), kind: "class".to_string(), line: i + 1 });
                } else if let Some(cap) = re_trait.captures(line) {
                    symbols.push(Symbol { name: cap[1].to_string(), kind: "interface".to_string(), line: i + 1 });
                }
            }
        },
        "ts" | "tsx" | "js" | "jsx" => {
            let re_fn = Regex::new(r"(?:function|const|let)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:=|\()").unwrap();
            let re_class = Regex::new(r"class\s+([a-zA-Z_][a-zA-Z0-9_]*)").unwrap();
            let re_interface = Regex::new(r"interface\s+([a-zA-Z_][a-zA-Z0-9_]*)").unwrap();
            let re_type = Regex::new(r"type\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*=").unwrap();

            for (i, line) in content.lines().enumerate() {
                if let Some(cap) = re_fn.captures(line) {
                    symbols.push(Symbol { name: cap[1].to_string(), kind: "function".to_string(), line: i + 1 });
                } else if let Some(cap) = re_class.captures(line) {
                    symbols.push(Symbol { name: cap[1].to_string(), kind: "class".to_string(), line: i + 1 });
                } else if let Some(cap) = re_interface.captures(line) {
                    symbols.push(Symbol { name: cap[1].to_string(), kind: "interface".to_string(), line: i + 1 });
                } else if let Some(cap) = re_type.captures(line) {
                    symbols.push(Symbol { name: cap[1].to_string(), kind: "interface".to_string(), line: i + 1 });
                }
            }
        },
        "py" => {
            let re_def = Regex::new(r"def\s+([a-zA-Z_][a-zA-Z0-9_]*)").unwrap();
            let re_class = Regex::new(r"class\s+([a-zA-Z_][a-zA-Z0-9_]*)").unwrap();

            for (i, line) in content.lines().enumerate() {
                if let Some(cap) = re_def.captures(line) {
                    symbols.push(Symbol { name: cap[1].to_string(), kind: "function".to_string(), line: i + 1 });
                } else if let Some(cap) = re_class.captures(line) {
                    symbols.push(Symbol { name: cap[1].to_string(), kind: "class".to_string(), line: i + 1 });
                }
            }
        },
        _ => {}
    }

    Ok(symbols)
}
