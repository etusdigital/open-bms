import { LeadStateMessage, StepType } from '../interfaces';
import { ActiveStepsHandler } from './activesteps.handler';

describe('Handler: ActiveSteps', () => {
  let activeStepsHandler: ActiveStepsHandler = null;

  beforeEach(() => {
    activeStepsHandler = new ActiveStepsHandler();
  });

  describe('createNextLeadStateMessage', () => {
    beforeEach(() => {
      process.env.TOPIC_NAME_MESSAGE_TRIGGER = 'msgops.message.trigger';
    });

    it('should return next step from step.child when child exists', () => {
      // Arrange
      const mockLeadStateMessage: LeadStateMessage = {
        id: 'lead-123',
        automation: {
          id: 25,
          type: 'email',
          title: 'Test Automation',
          steps: [
            {
              id: 1,
              type: StepType.EMAIL,
              settings: { id: 100 },
            },
          ],
        },
        startedAt: Date.now(),
        activeStepId: '1',
        contact: {
          email: 'test@example.com',
          firstName: 'Test',
        },
        tagName: 'test-tag',
      };

      const currentStep = {
        id: 1,
        type: StepType.EMAIL,
        settings: { id: 100 },
        child: [
          {
            id: 2,
            type: StepType.WAIT,
            settings: { timer: 60, timerType: 'minutes' },
          },
          {
            id: 3,
            type: StepType.EMAIL,
            settings: { id: 101 },
          },
        ],
      };

      // Act
      const result = activeStepsHandler.createNextLeadStateMessage(mockLeadStateMessage, currentStep);

      // Assert
      expect(result.pubName).toBe('msgops.message.trigger');
      expect(result.data.automation.steps).toEqual(currentStep.child);
      expect(result.data.automation.steps.length).toBe(2);
      expect(result.data.automation.steps[0].id).toBe(2);
      expect(result.data.activeStepId).toBe('2');
    });

    it('should return END step when step.child is undefined', () => {
      // Arrange
      const mockLeadStateMessage: LeadStateMessage = {
        id: 'lead-456',
        automation: {
          id: 30,
          type: 'email',
          title: 'Test Automation',
          steps: [],
        },
        startedAt: Date.now(),
        activeStepId: '5',
        contact: {
          email: 'test@example.com',
        },
      };

      const currentStep = {
        id: 5,
        type: StepType.EMAIL,
        settings: { id: 200 },
        // No child property
      };

      // Act
      const result = activeStepsHandler.createNextLeadStateMessage(mockLeadStateMessage, currentStep);

      // Assert
      expect(result.data.automation.steps.length).toBe(1);
      expect(result.data.automation.steps[0].type).toBe('end');
      expect(result.data.automation.steps[0].id).toBe(0);
      expect(result.data.activeStepId).toBe('0');
    });

    it('should return END step when step.child is empty array', () => {
      // Arrange
      const mockLeadStateMessage: LeadStateMessage = {
        id: 'lead-789',
        automation: {
          id: 40,
          type: 'email',
          title: 'Test Automation',
          steps: [],
        },
        startedAt: Date.now(),
        activeStepId: '10',
        contact: {
          email: 'test@example.com',
        },
      };

      const currentStep = {
        id: 10,
        type: StepType.ADD_TAG,
        settings: { tagName: 'completed' },
        child: [], // Empty array
      };

      // Act
      const result = activeStepsHandler.createNextLeadStateMessage(mockLeadStateMessage, currentStep);

      // Assert
      expect(result.data.automation.steps.length).toBe(1);
      expect(result.data.automation.steps[0].type).toBe('end');
      expect(result.data.automation.steps[0].id).toBe(0);
      expect(result.data.activeStepId).toBe('0');
    });

    it('should preserve all leadStateMessage properties except automation.steps and activeStepId', () => {
      // Arrange
      const mockLeadStateMessage: LeadStateMessage = {
        id: 'lead-preserve-test',
        automation: {
          id: 50,
          type: 'transactional',
          title: 'Preserve Test',
          name: 'preserve-automation',
          version: '1.0',
          isRateLimit: true,
          steps: [],
        },
        startedAt: 1234567890,
        activeStepId: '15',
        activeEmailId: 3,
        leadId: 999,
        contact: {
          id: 123,
          email: 'preserve@example.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        tagName: 'important-tag',
        account: {
          id: 1,
          name: 'Test Account',
          customFields: ['field1'],
        },
      };

      const currentStep = {
        id: 15,
        type: StepType.EMAIL,
        child: [
          {
            id: 16,
            type: StepType.END,
            settings: {},
          },
        ],
      };

      // Act
      const result = activeStepsHandler.createNextLeadStateMessage(mockLeadStateMessage, currentStep);

      // Assert
      expect(result.data.id).toBe('lead-preserve-test');
      expect(result.data.startedAt).toBe(1234567890);
      expect(result.data.activeEmailId).toBe(3);
      expect(result.data.leadId).toBe(999);
      expect(result.data.contact.email).toBe('preserve@example.com');
      expect(result.data.tagName).toBe('important-tag');
      expect(result.data.automation.id).toBe(50);
      expect(result.data.automation.type).toBe('transactional');
      expect(result.data.automation.title).toBe('Preserve Test');
      expect(result.data.automation.name).toBe('preserve-automation');
      expect(result.data.automation.version).toBe('1.0');
      expect(result.data.automation.isRateLimit).toBe(true);
      expect(result.data.account).toEqual(mockLeadStateMessage.account);
    });

    it('should handle CONDITIONAL step with child branches', () => {
      // Arrange
      const mockLeadStateMessage: LeadStateMessage = {
        id: 'lead-conditional',
        automation: {
          id: 60,
          type: 'email',
          title: 'Conditional Test',
          steps: [],
        },
        startedAt: Date.now(),
        activeStepId: '20',
        contact: {
          email: 'conditional@example.com',
        },
      };

      const conditionalStep = {
        id: 20,
        type: StepType.CONDITIONAL,
        settings: [
          {
            type: 'tag',
            conditional_tag: 'in',
            tag_id: [1, 2, 3],
          },
        ],
        child: [
          {
            id: 21, // Added id
            type: 'conditionalTrue',
            child: [
              {
                id: 22,
                type: StepType.EMAIL,
                settings: { id: 300 },
              },
            ],
          },
          {
            id: 23, // Added id
            type: 'conditionalFalse',
            child: [
              {
                id: 24,
                type: StepType.EMAIL,
                settings: { id: 301 },
              },
            ],
          },
        ],
      };

      // Act
      const result = activeStepsHandler.createNextLeadStateMessage(mockLeadStateMessage, conditionalStep);

      // Assert
      expect(result.data.automation.steps).toEqual(conditionalStep.child);
      expect(result.data.automation.steps.length).toBe(2);
      expect(result.data.automation.steps[0].id).toBe(21);
      expect(result.data.automation.steps[0].type).toBe('conditionalTrue');
      expect(result.data.automation.steps[1].id).toBe(23);
      expect(result.data.automation.steps[1].type).toBe('conditionalFalse');
      expect(result.data.activeStepId).toBe('21');
    });

    it('should convert numeric id to string for activeStepId', () => {
      // Arrange
      const mockLeadStateMessage: LeadStateMessage = {
        id: 'lead-id-convert',
        automation: {
          id: 70,
          type: 'email',
          title: 'ID Convert Test',
          steps: [],
        },
        startedAt: Date.now(),
        activeStepId: '100',
        contact: {
          email: 'idconvert@example.com',
        },
      };

      const currentStep = {
        id: 100,
        type: StepType.EMAIL,
        child: [
          {
            id: 200,
            type: StepType.WAIT,
            settings: { timer: 120 },
          },
        ],
      };

      // Act
      const result = activeStepsHandler.createNextLeadStateMessage(mockLeadStateMessage, currentStep);

      // Assert
      expect(typeof result.data.activeStepId).toBe('string');
      expect(result.data.activeStepId).toBe('200');
    });

    it('should use TOPIC_NAME_MESSAGE_TRIGGER from environment', () => {
      // Arrange
      const customTopic = 'custom.topic.name';
      process.env.TOPIC_NAME_MESSAGE_TRIGGER = customTopic;

      const mockLeadStateMessage: LeadStateMessage = {
        id: 'lead-topic',
        automation: {
          id: 80,
          type: 'email',
          steps: [],
        },
        startedAt: Date.now(),
        activeStepId: '50',
        contact: {
          email: 'topic@example.com',
        },
      };

      const currentStep = {
        id: 50,
        type: StepType.END,
      };

      // Act
      const result = activeStepsHandler.createNextLeadStateMessage(mockLeadStateMessage, currentStep);

      // Assert
      expect(result.pubName).toBe(customTopic);
    });
  });
});
