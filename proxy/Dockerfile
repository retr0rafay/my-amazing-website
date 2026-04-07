FROM golang:1.23-alpine AS build

WORKDIR /src
RUN apk add --no-cache git
RUN git clone --depth=1 https://github.com/teslamotors/vehicle-command.git .
COPY railway-http-proxy.go /src/cmd/railway-http-proxy/main.go
RUN go build -o /out/tesla-http-proxy ./cmd/tesla-http-proxy
RUN go build -o /out/railway-http-proxy ./cmd/railway-http-proxy

FROM alpine:3.20

RUN apk add --no-cache ca-certificates
COPY --from=build /out/railway-http-proxy /usr/local/bin/railway-http-proxy
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
