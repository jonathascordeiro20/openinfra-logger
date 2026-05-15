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

impl Logger {
    pub fn new(config: Config) -> Self {
        Logger { config }
    }

    pub fn log(&self, message: &str, level: &str, metadata: HashMap<String, String>) {
        let timestamp = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
        
        // A foundational zero-dependency JSON builder
        let mut json = format!(r#"{{"timestamp":"{}","level":"{}","message":"{}""#, timestamp, level, message);
        
        for (k, v) in &self.config.default_metadata {
            json.push_str(&format!(r#","{}":"{}""#, k, v));
        }
        for (k, v) in &metadata {
            json.push_str(&format!(r#","{}":"{}""#, k, v));
        }
        json.push_str("}");

        if self.config.transports.contains(&"console".to_string()) {
            println!("{}", json);
        }

        if self.config.transports.contains(&"file".to_string()) {
            if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&self.config.file_path) {
                let _ = writeln!(file, "{}", json);
            }
        }
    }
}
