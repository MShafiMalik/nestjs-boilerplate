import { Injectable } from '@nestjs/common';
import Bowser from 'bowser';

@Injectable()
export class DeviceParserService {
  parse(userAgent: string | undefined): {
    deviceName?: string;
    osVersion?: string;
  } {
    if (!userAgent || userAgent.trim().length === 0) {
      return {};
    }

    const parsed = Bowser.parse(userAgent);
    const browserName = parsed.browser.name;
    const platformType = parsed.platform.type;
    const osVersion = parsed.os.version;

    const deviceNameParts = [browserName, platformType].filter(
      (part): part is string => typeof part === 'string' && part.length > 0,
    );

    return {
      ...(deviceNameParts.length > 0 ? { deviceName: deviceNameParts.join(' ') } : {}),
      ...(typeof osVersion === 'string' && osVersion.length > 0 ? { osVersion } : {}),
    };
  }
}
