import * as fs from 'fs';
import * as path from 'path';
import * as protoLoader from '@grpc/proto-loader';

describe('GeoIP Proto File', () => {
  const protoPath = path.join(__dirname, 'geoip.proto');

  it('should exist', () => {
    expect(fs.existsSync(protoPath)).toBe(true);
  });

  it('should be loadable by proto-loader', () => {
    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    expect(packageDefinition).toBeDefined();
  });

  it('should contain expected service and message definitions', () => {
    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    // Extract the service definition
    const protoDescriptor = packageDefinition as any;

    // Test the existence of service and message types
    expect(protoDescriptor['geoip.GeoIpService']).toBeDefined();
    expect(protoDescriptor['geoip.GeoIpService'].GetLocation).toBeDefined();
    expect(protoDescriptor['geoip.IpRequest']).toBeDefined();
    expect(protoDescriptor['geoip.LocationResponse']).toBeDefined();
    expect(protoDescriptor['geoip.Traits']).toBeDefined();

    // Test message structure
    const ipRequestFields = protoDescriptor['geoip.IpRequest'].type.field;
    expect(ipRequestFields.find((f: any) => f.name === 'ip')).toBeDefined();

    const locationResponseFields = protoDescriptor['geoip.LocationResponse'].type.field;
    expect(locationResponseFields.find((f: any) => f.name === 'country')).toBeDefined();
    expect(locationResponseFields.find((f: any) => f.name === 'region')).toBeDefined();
    expect(locationResponseFields.find((f: any) => f.name === 'city')).toBeDefined();
    expect(locationResponseFields.find((f: any) => f.name === 'postalCode')).toBeDefined();
    expect(locationResponseFields.find((f: any) => f.name === 'timezone')).toBeDefined();
    expect(locationResponseFields.find((f: any) => f.name === 'latitude')).toBeDefined();
    expect(locationResponseFields.find((f: any) => f.name === 'longitude')).toBeDefined();
    expect(locationResponseFields.find((f: any) => f.name === 'success')).toBeDefined();
    expect(locationResponseFields.find((f: any) => f.name === 'error')).toBeDefined();

    const traitsField = locationResponseFields.find((f: any) => f.name === 'traits');
    expect(traitsField).toBeDefined();
    expect(traitsField.type).toBe('TYPE_MESSAGE');
    expect(traitsField.typeName).toBe('Traits');

    const traitsFields = protoDescriptor['geoip.Traits'].type.field;
    expect(traitsFields.find((f: any) => f.name === 'asn')).toBeDefined();
    expect(traitsFields.find((f: any) => f.name === 'asn_org')).toBeDefined();
    expect(traitsFields.find((f: any) => f.name === 'isp')).toBeDefined();
    expect(traitsFields.find((f: any) => f.name === 'organization')).toBeDefined();
    expect(traitsFields.find((f: any) => f.name === 'user_type')).toBeDefined();
    expect(traitsFields.find((f: any) => f.name === 'connection_type')).toBeDefined();
    expect(traitsFields.find((f: any) => f.name === 'is_anycast')).toBeDefined();
  });
});
