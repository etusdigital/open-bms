import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { DataSource, EntitySubscriberInterface, EventSubscriber, InsertEvent, RemoveEvent, SoftRemoveEvent, UpdateEvent } from 'typeorm';
import { AuditEntity } from '../entities/audit.entity';

const EXCLUDED_TABLES = ['audits', 'users_activities'];

@Injectable()
@EventSubscriber()
export class AuditSubscriber implements EntitySubscriberInterface {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cls: ClsService,
  ) {
    dataSource.subscribers.push(this);
  }

  private getContext(): { accountId: number; userId: string; ipAddress: string; userAgent: string } | null {
    const accountId = this.cls.get<number>('accountId');
    if (!accountId) return null;

    return {
      accountId,
      userId: String(this.cls.get('userId') ?? ''),
      ipAddress: this.cls.get<string>('ipAddress') ?? null,
      userAgent: this.cls.get<string>('userAgent') ?? null,
    };
  }

  private isExcluded(tableName: string): boolean {
    return EXCLUDED_TABLES.includes(tableName);
  }

  private save(data: Partial<AuditEntity>): void {
    this.dataSource.manager.save(AuditEntity, this.dataSource.manager.create(AuditEntity, data)).catch(() => null);
  }

  afterInsert(event: InsertEvent<any>): void {
    const tableName = event.metadata.tableName;
    if (this.isExcluded(tableName)) return;

    const ctx = this.getContext();
    if (!ctx) return;

    const entityId = event.entity?.id;
    if (!entityId) return;

    this.save({
      accountId: ctx.accountId,
      entity: tableName,
      entityId,
      type: 'INSERT',
      oldValues: null,
      newValues: event.entity,
      user: ctx.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  afterUpdate(event: UpdateEvent<any>): void {
    const tableName = event.metadata.tableName;
    if (this.isExcluded(tableName)) return;

    const ctx = this.getContext();
    if (!ctx) return;

    const entityId = event.entity?.id ?? event.databaseEntity?.id;
    if (!entityId) return;

    this.save({
      accountId: ctx.accountId,
      entity: tableName,
      entityId,
      type: 'UPDATE',
      oldValues: event.databaseEntity ?? null,
      newValues: event.entity,
      user: ctx.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  afterSoftRemove(event: SoftRemoveEvent<any>): void {
    const tableName = event.metadata.tableName;
    if (this.isExcluded(tableName)) return;

    const ctx = this.getContext();
    if (!ctx) return;

    const entityId = event.entity?.id;
    if (!entityId) return;

    this.save({
      accountId: ctx.accountId,
      entity: tableName,
      entityId,
      type: 'SOFT_DELETE',
      oldValues: event.entity,
      newValues: null,
      user: ctx.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }

  afterRemove(event: RemoveEvent<any>): void {
    const tableName = event.metadata.tableName;
    if (this.isExcluded(tableName)) return;

    const ctx = this.getContext();
    if (!ctx) return;

    const entityId = event.entityId ?? event.databaseEntity?.id;
    if (!entityId) return;

    this.save({
      accountId: ctx.accountId,
      entity: tableName,
      entityId,
      type: 'DELETE',
      oldValues: event.databaseEntity ?? null,
      newValues: null,
      user: ctx.userId,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });
  }
}
