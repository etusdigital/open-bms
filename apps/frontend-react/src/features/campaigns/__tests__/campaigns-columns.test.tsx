// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { getCoreRowModel, useReactTable, flexRender } from '@tanstack/react-table';
import { TooltipProvider } from '@/components/ui/tooltip';
import { useCampaignsColumns } from '../campaigns-columns';
import { CampaignStatus, type CampaignWithStats } from '../types';

const baseCampaign: CampaignWithStats = {
  id: 1,
  title: 'Newsletter de Maio',
  type: 'simple',
  messageType: 'email',
  status: CampaignStatus.Scheduled,
  sendToAll: true,
  deliveredRate: '—',
  openRate: '—',
  ctr: '—',
  ctor: '—',
  unsubscribeCount: 0,
  bounceCount: 0,
};

function ColumnsTable({ campaigns }: { campaigns: CampaignWithStats[] }) {
  const columns = useCampaignsColumns({
    onDelete: vi.fn(),
    onDuplicate: vi.fn(),
    onPreviewMessage: vi.fn(),
    canDelete: true,
    canDuplicate: true,
  });
  const table = useReactTable({
    columns,
    data: campaigns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <TooltipProvider>
      <table>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} data-column={cell.column.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </TooltipProvider>
  );
}

async function scheduleCellText(campaign: CampaignWithStats): Promise<string> {
  const { container } = await renderWithRouter(<ColumnsTable campaigns={[campaign]} />);
  const cell = container.querySelector('td[data-column="scheduleTo"]');
  expect(cell).not.toBeNull();
  return cell?.textContent ?? '';
}

describe('useCampaignsColumns — scheduleTo column', () => {
  it('renders date AND time for a scheduled campaign (EVO-1411)', async () => {
    const scheduleTo = '2026-05-19T14:30:00.000Z';
    const text = await scheduleCellText({ ...baseCampaign, scheduleTo });

    // Must include a time portion (HH:MM) — the bug was date-only output.
    expect(text).toMatch(/\d{1,2}:\d{2}/);
    // Must still carry the date — not be reduced to just a time.
    expect(text).not.toBe(new Date(scheduleTo).toLocaleTimeString());
    // Output must respect the user's locale (default-locale formatter).
    expect(text).toBe(
      new Date(scheduleTo).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' }),
    );
  });

  it('renders an em dash when scheduleTo is absent', async () => {
    expect(await scheduleCellText({ ...baseCampaign, scheduleTo: undefined })).toBe('—');
  });
});
