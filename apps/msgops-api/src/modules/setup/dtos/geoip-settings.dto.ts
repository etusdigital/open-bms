import Joi from 'joi';
import { JoiSchema } from 'nestjs-joi';

// Persisted shape (and wire shape) of the GeoIP setup choice.
// Mode is the user-facing decision; provider/credentials only matter for
// 'advanced'. Keeping it as one DTO instead of three discriminated forms
// lets the wizard send a single payload regardless of choice.
export type GeoIpMode = 'disabled' | 'lite' | 'advanced';
export type GeoIpProvider = 'dbip-full' | 'maxmind' | 'ip-api' | 'ipinfo';

// Joi gotcha: in `.when('field', { is: schema, ... })`, an optional `is`
// schema also matches `undefined`. So a naive `is: Joi.valid('dbip-full', ...)`
// fires `then` even when `provider` is absent (mode=disabled / mode=lite),
// requiring apiKey on free-tier submissions. The matchers below add
// `.required()` so undefined no longer slips through.
const apiKeyProviderMatch = Joi.string().valid('dbip-full', 'ip-api', 'ipinfo').required();

const maxmindProviderMatch = Joi.string().valid('maxmind').required();

export class GeoIpSettingsDto {
  @JoiSchema(Joi.string().valid('disabled', 'lite', 'advanced').required())
  mode: GeoIpMode;

  @JoiSchema(Joi.string().valid('dbip-full', 'maxmind', 'ip-api', 'ipinfo').when('mode', { is: 'advanced', then: Joi.required(), otherwise: Joi.forbidden() }))
  provider?: GeoIpProvider;

  // dbip-full / ip-api / ipinfo: API key. Required when those providers are
  // selected. MaxMind uses accountId + licenseKey instead.
  @JoiSchema(
    Joi.string().trim().min(8).max(512).when('provider', {
      is: apiKeyProviderMatch,
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
  )
  apiKey?: string;

  @JoiSchema(
    Joi.string().trim().pattern(/^\d+$/).when('provider', {
      is: maxmindProviderMatch,
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
  )
  accountId?: string;

  @JoiSchema(
    Joi.string().trim().min(8).max(512).when('provider', {
      is: maxmindProviderMatch,
      then: Joi.required(),
      otherwise: Joi.forbidden(),
    }),
  )
  licenseKey?: string;
}

export const geoIpSettingsSchema = Joi.object<GeoIpSettingsDto>({
  mode: Joi.string().valid('disabled', 'lite', 'advanced').required(),
  provider: Joi.string().valid('dbip-full', 'maxmind', 'ip-api', 'ipinfo').when('mode', { is: 'advanced', then: Joi.required(), otherwise: Joi.forbidden() }),
  apiKey: Joi.string().trim().min(8).max(512).when('provider', {
    is: apiKeyProviderMatch,
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  accountId: Joi.string().trim().pattern(/^\d+$/).when('provider', {
    is: maxmindProviderMatch,
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
  licenseKey: Joi.string().trim().min(8).max(512).when('provider', {
    is: maxmindProviderMatch,
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }),
});
