/*
 * OpenInfra Logger
 * Critical infrastructure library for structured observability.
 *
 * @author Jonathas Cordeiro (@jonathascordeiro20)
 * @license MIT
 * @copyright (c) 2026 Jonathas Cordeiro
 */
use std::collections::HashMap;
use std::fs::OpenOptions;
use std::io::Write;
use std::time::{SystemTime, UNIX_EPOCH};

pub struct Config {
    pub transports: Vec<String>,
    pub file_path: String,
    pub default_metadata: HashMap<String, String>,
}

impl Default for Config {
    fn default() -> Self {
        Config {
            transports: vec!["console".to_string()],
            file_path: "./app.log".to_string(),
            default_metadata: HashMap::new(),
        }
    }
}

pub struct Logger {
    pub config: Config,
}

/// Escapes a string for safe inclusion as a JSON string value (RFC 8259).
/// Without this, embedded quotes / backslashes / control chars produce invalid JSON.
pub fn escape_json_string(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '\x08' => out.push_str("\\b"),
            '\x0c' => out.push_str("\\f"),
            c if (c as u32) < 0x20 => {
                out.push_str(&format!("\\u{:04x}", c as u32));
            }
            c => out.push(c),
        }
    }
    out
}

/// Pure function that builds the JSON line, exposed for unit testing.
pub fn build_json_line(
    message: &str,
    level: &str,
    timestamp_secs: u64,
    default_metadata: &HashMap<String, String>,
    metadata: &HashMap<String, String>,
) -> String {
    let mut json = String::new();
    json.push('{');
    json.push_str(&format!(
        r#""timestamp":"{}","level":"{}","message":"{}""#,
        timestamp_secs,
        escape_json_string(level),
        escape_json_string(message),
    ));
    for (k, v) in default_metadata {
        json.push_str(&format!(
            r#","{}":"{}""#,
            escape_json_string(k),
            escape_json_string(v),
        ));
    }
    for (k, v) in metadata {
        json.push_str(&format!(
            r#","{}":"{}""#,
            escape_json_string(k),
            escape_json_string(v),
        ));
    }
    json.push('}');
    json
}

impl Logger {
    pub fn new(config: Config) -> Self {
        Logger { config }
    }

    pub fn log(&self, message: &str, level: &str, metadata: HashMap<String, String>) {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let json = build_json_line(
            message,
            level,
            timestamp,
            &self.config.default_metadata,
            &metadata,
        );

        if self.config.transports.contains(&"console".to_string()) {
            println!("{}", json);
        }

        if self.config.transports.contains(&"file".to_string()) {
            if let Ok(mut file) = OpenOptions::new()
                .create(true)
                .append(true)
                .open(&self.config.file_path)
            {
                let _ = writeln!(file, "{}", json);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::fs;
    use std::path::PathBuf;

    fn parse_json(s: &str) -> serde_json_lite::Value {
        serde_json_lite::parse(s).expect("invalid JSON")
    }

    // Minimal zero-dependency JSON parser sufficient for our test assertions.
    // (Keeps Cargo.toml free of dependencies as the original design intended.)
    mod serde_json_lite {
        use std::collections::HashMap;

        #[derive(Debug, Clone)]
        pub enum Value {
            Str(String),
            Num(f64),
            Bool(bool),
            Null,
            Array(Vec<Value>),
            Object(HashMap<String, Value>),
        }

        impl Value {
            pub fn as_str(&self) -> Option<&str> {
                if let Value::Str(s) = self { Some(s) } else { None }
            }
            pub fn get(&self, key: &str) -> Option<&Value> {
                if let Value::Object(m) = self { m.get(key) } else { None }
            }
        }

        struct Parser<'a> { src: &'a [u8], pos: usize }

        impl<'a> Parser<'a> {
            fn skip_ws(&mut self) {
                while self.pos < self.src.len() && matches!(self.src[self.pos], b' '|b'\t'|b'\n'|b'\r') {
                    self.pos += 1;
                }
            }
            fn peek(&self) -> Option<u8> { self.src.get(self.pos).copied() }
            fn bump(&mut self) -> Option<u8> { let c = self.peek()?; self.pos += 1; Some(c) }

            fn parse_value(&mut self) -> Result<Value, String> {
                self.skip_ws();
                match self.peek().ok_or("unexpected end")? {
                    b'"' => self.parse_string().map(Value::Str),
                    b'{' => self.parse_object(),
                    b'[' => self.parse_array(),
                    b't' | b'f' => self.parse_bool(),
                    b'n' => self.parse_null(),
                    _ => self.parse_number(),
                }
            }

            fn parse_string(&mut self) -> Result<String, String> {
                if self.bump() != Some(b'"') { return Err("expected '\"'".into()); }
                // Accumulate UTF-8 bytes verbatim so multibyte sequences are preserved.
                let mut buf: Vec<u8> = Vec::new();
                loop {
                    let c = self.bump().ok_or("unterminated string")?;
                    if c == b'"' {
                        return String::from_utf8(buf).map_err(|e| e.to_string());
                    }
                    if c == b'\\' {
                        let esc = self.bump().ok_or("bad escape")?;
                        match esc {
                            b'"' => buf.push(b'"'),
                            b'\\' => buf.push(b'\\'),
                            b'/' => buf.push(b'/'),
                            b'n' => buf.push(b'\n'),
                            b'r' => buf.push(b'\r'),
                            b't' => buf.push(b'\t'),
                            b'b' => buf.push(0x08),
                            b'f' => buf.push(0x0c),
                            b'u' => {
                                let mut hex = String::new();
                                for _ in 0..4 { hex.push(self.bump().ok_or("bad \\u")? as char); }
                                let cp = u32::from_str_radix(&hex, 16).map_err(|e| e.to_string())?;
                                if let Some(ch) = char::from_u32(cp) {
                                    let mut tmp = [0u8; 4];
                                    let s = ch.encode_utf8(&mut tmp);
                                    buf.extend_from_slice(s.as_bytes());
                                }
                            }
                            _ => return Err(format!("unknown escape \\{}", esc as char)),
                        }
                    } else {
                        buf.push(c);
                    }
                }
            }

            fn parse_object(&mut self) -> Result<Value, String> {
                self.bump(); // '{'
                let mut m = HashMap::new();
                self.skip_ws();
                if self.peek() == Some(b'}') { self.bump(); return Ok(Value::Object(m)); }
                loop {
                    self.skip_ws();
                    let key = self.parse_string()?;
                    self.skip_ws();
                    if self.bump() != Some(b':') { return Err("expected ':'".into()); }
                    let val = self.parse_value()?;
                    m.insert(key, val);
                    self.skip_ws();
                    match self.bump() {
                        Some(b',') => continue,
                        Some(b'}') => return Ok(Value::Object(m)),
                        _ => return Err("expected ',' or '}'".into()),
                    }
                }
            }

            fn parse_array(&mut self) -> Result<Value, String> {
                self.bump();
                let mut v = Vec::new();
                self.skip_ws();
                if self.peek() == Some(b']') { self.bump(); return Ok(Value::Array(v)); }
                loop {
                    v.push(self.parse_value()?);
                    self.skip_ws();
                    match self.bump() {
                        Some(b',') => continue,
                        Some(b']') => return Ok(Value::Array(v)),
                        _ => return Err("expected ',' or ']'".into()),
                    }
                }
            }

            fn parse_bool(&mut self) -> Result<Value, String> {
                if self.src[self.pos..].starts_with(b"true") { self.pos += 4; Ok(Value::Bool(true)) }
                else if self.src[self.pos..].starts_with(b"false") { self.pos += 5; Ok(Value::Bool(false)) }
                else { Err("bad bool".into()) }
            }

            fn parse_null(&mut self) -> Result<Value, String> {
                if self.src[self.pos..].starts_with(b"null") { self.pos += 4; Ok(Value::Null) }
                else { Err("bad null".into()) }
            }

            fn parse_number(&mut self) -> Result<Value, String> {
                let start = self.pos;
                while let Some(c) = self.peek() {
                    if c.is_ascii_digit() || c == b'-' || c == b'+' || c == b'.' || c == b'e' || c == b'E' {
                        self.pos += 1;
                    } else { break; }
                }
                let s = std::str::from_utf8(&self.src[start..self.pos]).map_err(|e| e.to_string())?;
                s.parse::<f64>().map(Value::Num).map_err(|e| e.to_string())
            }
        }

        pub fn parse(s: &str) -> Result<Value, String> {
            let mut p = Parser { src: s.as_bytes(), pos: 0 };
            p.parse_value()
        }
    }

    #[test]
    fn test_escape_quotes_and_backslash() {
        let out = build_json_line(
            r#"with "quotes" and \backslash"#,
            "info",
            1000,
            &HashMap::new(),
            &HashMap::new(),
        );
        let parsed = parse_json(&out);
        assert_eq!(parsed.get("message").and_then(|v| v.as_str()).unwrap(),
                   r#"with "quotes" and \backslash"#);
    }

    #[test]
    fn test_escape_newlines_and_tabs() {
        let out = build_json_line("line1\nline2\there", "info", 1, &HashMap::new(), &HashMap::new());
        let parsed = parse_json(&out);
        assert_eq!(parsed.get("message").and_then(|v| v.as_str()).unwrap(), "line1\nline2\there");
    }

    #[test]
    fn test_unicode_passthrough() {
        let out = build_json_line("hello 🚀 中文", "info", 1, &HashMap::new(), &HashMap::new());
        let parsed = parse_json(&out);
        assert_eq!(parsed.get("message").and_then(|v| v.as_str()).unwrap(), "hello 🚀 中文");
    }

    #[test]
    fn test_control_chars_escaped() {
        let out = build_json_line("bell:\x07 null:\x00", "info", 1, &HashMap::new(), &HashMap::new());
        // Must be valid JSON despite control chars in input
        let parsed = parse_json(&out);
        assert!(parsed.get("message").is_some());
    }

    #[test]
    fn test_basic_fields_present() {
        let mut md = HashMap::new();
        md.insert("user".to_string(), "alice".to_string());
        let out = build_json_line("msg", "warn", 1234, &HashMap::new(), &md);
        let parsed = parse_json(&out);
        assert_eq!(parsed.get("level").and_then(|v| v.as_str()).unwrap(), "warn");
        assert_eq!(parsed.get("user").and_then(|v| v.as_str()).unwrap(), "alice");
    }

    #[test]
    fn test_default_metadata_included() {
        let mut defaults = HashMap::new();
        defaults.insert("service".to_string(), "billing".to_string());
        let out = build_json_line("msg", "info", 1, &defaults, &HashMap::new());
        let parsed = parse_json(&out);
        assert_eq!(parsed.get("service").and_then(|v| v.as_str()).unwrap(), "billing");
    }

    #[test]
    fn test_file_transport_writes_valid_json() {
        let tmp = std::env::temp_dir().join("openinfra_rust_test.log");
        let _ = fs::remove_file(&tmp);
        let cfg = Config {
            transports: vec!["file".to_string()],
            file_path: tmp.to_string_lossy().to_string(),
            default_metadata: HashMap::new(),
        };
        let logger = Logger::new(cfg);
        let mut md = HashMap::new();
        md.insert("k".to_string(), r#"val with "quotes""#.to_string());
        logger.log(r#"crit "alert""#, "error", md);

        let content = fs::read_to_string(&tmp).expect("read log");
        let last_line = content.lines().last().expect("at least one line");
        let parsed = parse_json(last_line);
        assert_eq!(parsed.get("message").and_then(|v| v.as_str()).unwrap(), r#"crit "alert""#);
        assert_eq!(parsed.get("k").and_then(|v| v.as_str()).unwrap(), r#"val with "quotes""#);
        assert_eq!(parsed.get("level").and_then(|v| v.as_str()).unwrap(), "error");

        let _ = fs::remove_file(&tmp);
        // Reference PathBuf to keep import used
        let _: PathBuf = tmp;
    }
}
