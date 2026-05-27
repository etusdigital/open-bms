FROM golang:1.22-alpine AS build
WORKDIR /src
COPY apps/sendgrid-mock/go.mod ./
COPY apps/sendgrid-mock/main.go ./
RUN CGO_ENABLED=0 go build -o /out/sendgrid-mock ./

FROM gcr.io/distroless/static:nonroot
COPY --from=build /out/sendgrid-mock /sendgrid-mock
EXPOSE 3010
USER nonroot:nonroot
ENTRYPOINT ["/sendgrid-mock"]
