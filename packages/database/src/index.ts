import 'reflect-metadata';

export * from './entities';
export * from './enums';

import { Account } from './entities/account.entity';
import { Pool } from './entities/pool.entity';
import { User } from './entities/user.entity';
import { UserAccount } from './entities/user-account.entity';
import { RetentionAlert } from './entities/retention-alert.entity';
import { Campaign } from './entities/campaign.entity';
import { Automation } from './entities/automation.entity';
import { Ip } from './entities/ip.entity';
import { IpAssignment } from './entities/ip-assignment.entity';
import { IpReputationDaily } from './entities/ip-reputation-daily.entity';
import { GlobalMonitorTarget } from './entities/global-monitor-target.entity';
import { SubAccount } from './entities/sub-account.entity';
import { Sender } from './entities/sender.entity';
import { RoutingRule } from './entities/routing-rule.entity';
import { MsgopsSegment } from './entities/msgops-segment.entity';
import { Label } from './entities/label.entity';
import { Message } from './entities/message.entity';

export const entities = [
  Account,
  Pool,
  User,
  UserAccount,
  RetentionAlert,
  Campaign,
  Automation,
  Ip,
  IpAssignment,
  IpReputationDaily,
  GlobalMonitorTarget,
  SubAccount,
  Sender,
  RoutingRule,
  MsgopsSegment,
  Label,
  Message,
];
