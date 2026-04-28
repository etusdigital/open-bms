// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter } from '@/test-utils/render-with-router';
import '@/lib/i18n';
import { ContactChannelsCard } from '../components/contact-channels-card';
import type { Contact } from '../types';

const baseContact: Contact = {
  id: 1,
  email: 'john@example.com',
  isActive: true,
  isValid: true,
  isUnsubscribed: false,
  hasBounced: false,
  isBlocked: false,
  hasEmail: true,
  hasPhone: false,
  hasWebPush: false,
  hasMobilePush: false,
  hasWhatsapp: false,
};

describe('ContactChannelsCard', () => {
  describe('email channel status', () => {
    it('shows deliverable when email is valid and active', async () => {
      await renderWithRouter(<ContactChannelsCard contact={{ ...baseContact, email: 'a@b.com', isValid: true }} />);
      expect(screen.getByText(/entregável/i)).toBeInTheDocument();
    });

    it('shows unsubscribed status for unsubscribed contact', async () => {
      await renderWithRouter(<ContactChannelsCard contact={{ ...baseContact, isUnsubscribed: true }} />);
      expect(screen.getByText(/descadastrado/i)).toBeInTheDocument();
    });

    it('shows bounced status for bounced contact', async () => {
      await renderWithRouter(<ContactChannelsCard contact={{ ...baseContact, hasBounced: true }} />);
      expect(screen.getByText(/bounced/i)).toBeInTheDocument();
    });

    it('shows blocked status for blocked contact', async () => {
      await renderWithRouter(<ContactChannelsCard contact={{ ...baseContact, isBlocked: true }} />);
      expect(screen.getByText(/bloqueado/i)).toBeInTheDocument();
    });

    it('prioritizes blocked over unsubscribed', async () => {
      await renderWithRouter(
        <ContactChannelsCard contact={{ ...baseContact, isBlocked: true, isUnsubscribed: true }} />,
      );
      expect(screen.getByText(/bloqueado/i)).toBeInTheDocument();
    });

    it('shows inactive when email is not valid', async () => {
      await renderWithRouter(<ContactChannelsCard contact={{ ...baseContact, isValid: false }} />);
      expect(screen.getByText(/não entregável/i)).toBeInTheDocument();
    });
  });

  describe('channel visibility', () => {
    it('shows email row when contact has email', async () => {
      await renderWithRouter(<ContactChannelsCard contact={baseContact} />);
      expect(screen.getByText('Email')).toBeInTheDocument();
    });

    it('hides email row when contact has no email', async () => {
      await renderWithRouter(<ContactChannelsCard contact={{ ...baseContact, email: '' }} />);
      expect(screen.queryByText('Email')).not.toBeInTheDocument();
    });

    it('shows SMS row when contact has phone', async () => {
      await renderWithRouter(<ContactChannelsCard contact={{ ...baseContact, phone: '+5511999', hasPhone: true }} />);
      expect(screen.getByText('SMS')).toBeInTheDocument();
    });

    it('shows WhatsApp row when hasWhatsapp is true', async () => {
      await renderWithRouter(<ContactChannelsCard contact={{ ...baseContact, hasWhatsapp: true }} />);
      expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    });

    it('shows Web Push row when hasWebPush is true', async () => {
      await renderWithRouter(<ContactChannelsCard contact={{ ...baseContact, hasWebPush: true }} />);
      expect(screen.getByText('Web Push')).toBeInTheDocument();
    });

    it('shows Mobile Push row when hasMobilePush is true', async () => {
      await renderWithRouter(<ContactChannelsCard contact={{ ...baseContact, hasMobilePush: true }} />);
      expect(screen.getByText('Mobile Push')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows dash when no channels are visible', async () => {
      await renderWithRouter(<ContactChannelsCard contact={{ ...baseContact, email: '', hasEmail: false }} />);
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  describe('multiple channels', () => {
    it('renders multiple channel rows', async () => {
      await renderWithRouter(
        <ContactChannelsCard
          contact={{
            ...baseContact,
            hasWebPush: true,
            hasWhatsapp: true,
          }}
        />,
      );
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Web Push')).toBeInTheDocument();
      expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    });
  });
});
