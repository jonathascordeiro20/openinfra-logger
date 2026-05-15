package main

import (
	"fmt"
	logger "github.com/jonathascordeiro20/openinfra-logger/go"
)

func main() {
	fmt.Println("--- OpenInfra Go Logger Demonstration ---\n")

	logger.Configure(logger.Config{
		Transports: []string{"console"},
		DefaultMetadata: map[string]interface{}{
			"service": "billing-api",
			"env":     "production",
		},
	})

	logger.Log("Go worker initialized successfully", "info", map[string]interface{}{"worker_id": 101})
	logger.Log("Failed to sync database", "error", map[string]interface{}{"code": "DB_ERR"})

	fmt.Println("\n--- End of Demonstration ---")
}
