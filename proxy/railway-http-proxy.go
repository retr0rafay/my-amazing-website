package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/teslamotors/vehicle-command/internal/log"
	"github.com/teslamotors/vehicle-command/pkg/cli"
	"github.com/teslamotors/vehicle-command/pkg/proxy"
)

const cacheSize = 10000

func main() {
	cfg, err := cli.NewConfig(cli.FlagPrivateKey)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to init key config: %v\n", err)
		os.Exit(1)
	}
	cfg.ReadFromEnvironment()

	skey, err := cfg.PrivateKey()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load command key: %v\n", err)
		os.Exit(1)
	}

	if os.Getenv("TESLA_VERBOSE") == "1" || os.Getenv("TESLA_VERBOSE") == "true" {
		log.SetLevel(log.LevelDebug)
	}

	p, err := proxy.New(context.Background(), skey, cacheSize)
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to create proxy: %v\n", err)
		os.Exit(1)
	}

	if t := os.Getenv("TESLA_HTTP_PROXY_TIMEOUT"); t != "" {
		if d, derr := time.ParseDuration(t); derr == nil {
			p.Timeout = d
		}
	}

	host := os.Getenv("TESLA_HTTP_PROXY_HOST")
	if host == "" {
		host = "0.0.0.0"
	}
	port := os.Getenv("PORT")
	if port == "" {
		port = os.Getenv("TESLA_HTTP_PROXY_PORT")
	}
	if port == "" {
		port = "8080"
	}
	if _, err := strconv.Atoi(port); err != nil {
		fmt.Fprintf(os.Stderr, "invalid port: %s\n", port)
		os.Exit(1)
	}

	addr := fmt.Sprintf("%s:%s", host, port)
	log.Info("Railway HTTP proxy listening on %s", addr)
	if err := http.ListenAndServe(addr, p); err != nil {
		fmt.Fprintf(os.Stderr, "server stopped: %v\n", err)
		os.Exit(1)
	}
}
