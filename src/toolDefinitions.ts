import { FastMCP, UserError } from '@missionsquad/fastmcp';
import { z } from 'zod';
import { withMindbodyExecution } from './runtime.js';
import {
  getTeacherScheduleTool,
} from './tools/teacherSchedule.js';
import {
  addClientToClassTool,
  getClassDescriptionsTool,
  getClassSchedulesTool,
  getClassVisitsTool,
  getClassesTool,
  getWaitlistEntriesTool,
  removeClientFromClassTool,
  substituteClassTeacherTool,
} from './tools/classManagement.js';
import {
  addClientArrivalTool,
  addClientTool,
  getClientAccountBalancesTool,
  getClientContractsTool,
  getClientMembershipsTool,
  getClientVisitsTool,
  getClientsTool,
  updateClientTool,
} from './tools/clientManagement.js';
import {
  checkoutShoppingCartTool,
  getContractsTool,
  getPackagesTool,
  getProductsTool,
  getServicesTool,
  purchaseContractTool,
} from './tools/salesManagement.js';
import {
  getActivationCodeTool,
  getLocationsTool,
  getProgramsTool,
  getResourcesTool,
  getSessionTypesTool,
  getSitesTool,
  getStaffTool,
} from './tools/siteManagement.js';
import {
  addAppointmentTool,
  getActiveSessionTimesTool,
  getBookableItemsTool,
  getScheduleItemsTool,
  getStaffAppointmentsTool,
  updateAppointmentTool,
} from './tools/appointmentManagement.js';
import {
  addClientToEnrollmentTool,
  getClientEnrollmentsTool,
  getEnrollmentsTool,
} from './tools/enrollmentManagement.js';

type SchemaDefinition =
  | {
      type: 'string';
      description?: string;
      enum?: readonly [string, ...string[]];
    }
  | {
      type: 'number';
      description?: string;
    }
  | {
      type: 'boolean';
      description?: string;
    }
  | {
      type: 'array';
      description?: string;
      items: SchemaDefinition;
    }
  | {
      type: 'object';
      description?: string;
      properties?: Record<string, SchemaDefinition>;
      required?: readonly string[];
    };

type ObjectSchemaDefinition = Extract<SchemaDefinition, { type: 'object' }>;

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ObjectSchemaDefinition;
  execute: (args: any) => Promise<unknown>;
}

function describeSchema<T extends z.ZodTypeAny>(schema: T, description?: string): T {
  return description ? (schema.describe(description) as T) : schema;
}

function schemaToZod(schema: SchemaDefinition, isTopLevel = false): z.ZodTypeAny {
  switch (schema.type) {
    case 'string':
      return describeSchema(schema.enum ? z.enum(schema.enum) : z.string(), schema.description);
    case 'number':
      return describeSchema(z.number(), schema.description);
    case 'boolean':
      return describeSchema(z.boolean(), schema.description);
    case 'array':
      return describeSchema(z.array(schemaToZod(schema.items)), schema.description);
    case 'object': {
      const properties = schema.properties ?? {};
      const keys = Object.keys(properties);

      if (keys.length === 0) {
        return describeSchema(isTopLevel ? z.object({}) : z.record(z.unknown()), schema.description);
      }

      const required = new Set(schema.required ?? []);
      const shape: Record<string, z.ZodTypeAny> = {};

      for (const [key, value] of Object.entries(properties)) {
        const childSchema = schemaToZod(value);
        shape[key] = required.has(key) ? childSchema : childSchema.optional();
      }

      return describeSchema(z.object(shape), schema.description);
    }
  }
}

function toUserError(error: unknown, toolName: string): UserError {
  if (error instanceof UserError) {
    return error;
  }

  const message = error instanceof Error ? error.message : String(error);
  return new UserError(`${toolName} failed: ${message}`);
}

function stringifyResult(result: unknown): string {
  return JSON.stringify(result, null, 2);
}

export const mindbodyToolDefinitions: readonly ToolDefinition[] = [
  {
    name: 'getTeacherSchedule',
    description: "Get a teacher's class schedule for a specified date range",
    inputSchema: {
      type: 'object',
      properties: {
        teacherName: { type: 'string', description: 'The name of the teacher' },
        startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' },
      },
      required: ['teacherName'],
    },
    execute: async (args) =>
      getTeacherScheduleTool(args.teacherName, args.startDate, args.endDate),
  },
  {
    name: 'getStaff',
    description: 'Get all staff members with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        staffIds: { type: 'array', items: { type: 'number' }, description: 'Specific staff IDs to retrieve' },
        filters: { type: 'array', items: { type: 'string' }, description: 'Filters to apply' },
        sessionTypeIds: { type: 'array', items: { type: 'number' }, description: 'Session type IDs' },
        locationIds: { type: 'array', items: { type: 'number' }, description: 'Location IDs' },
        startDateTime: { type: 'string', description: 'Start date/time in ISO format' },
      },
    },
    execute: async (args) =>
      getStaffTool(args.staffIds, args.filters, args.sessionTypeIds, args.locationIds, args.startDateTime),
  },
  {
    name: 'getClasses',
    description: 'Get all classes with filtering options',
    inputSchema: {
      type: 'object',
      properties: {
        startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' },
        locationIds: { type: 'array', items: { type: 'number' }, description: 'Location IDs to filter by' },
        classDescriptionIds: { type: 'array', items: { type: 'number' }, description: 'Class description IDs' },
        staffIds: { type: 'array', items: { type: 'number' }, description: 'Staff IDs to filter by' },
      },
    },
    execute: async (args) =>
      getClassesTool(args.startDate, args.endDate, args.locationIds, args.classDescriptionIds, args.staffIds),
  },
  {
    name: 'getClassDescriptions',
    description: 'Get all class types/descriptions offered',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => getClassDescriptionsTool(),
  },
  {
    name: 'getClassSchedules',
    description: 'Get class schedules (recurring class templates)',
    inputSchema: {
      type: 'object',
      properties: {
        locationIds: { type: 'array', items: { type: 'number' }, description: 'Location IDs' },
        classDescriptionIds: { type: 'array', items: { type: 'number' }, description: 'Class description IDs' },
        staffIds: { type: 'array', items: { type: 'number' }, description: 'Staff IDs' },
        programIds: { type: 'array', items: { type: 'number' }, description: 'Program IDs' },
      },
    },
    execute: async (args) =>
      getClassSchedulesTool(args.locationIds, args.classDescriptionIds, args.staffIds, args.programIds),
  },
  {
    name: 'addClientToClass',
    description: 'Book a client into a class',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'Client ID' },
        classId: { type: 'number', description: 'Class ID to book' },
        requirePayment: { type: 'boolean', description: 'Require payment (default true)' },
        waitlist: { type: 'boolean', description: 'Add to waitlist if full (default false)' },
      },
      required: ['clientId', 'classId'],
    },
    execute: async (args) =>
      addClientToClassTool(args.clientId, args.classId, args.requirePayment, args.waitlist),
  },
  {
    name: 'removeClientFromClass',
    description: "Cancel a client's class booking",
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'Client ID' },
        classId: { type: 'number', description: 'Class ID' },
        lateCancel: { type: 'boolean', description: 'Mark as late cancel (default false)' },
      },
      required: ['clientId', 'classId'],
    },
    execute: async (args) => removeClientFromClassTool(args.clientId, args.classId, args.lateCancel),
  },
  {
    name: 'getWaitlistEntries',
    description: 'Get waitlist entries for classes',
    inputSchema: {
      type: 'object',
      properties: {
        classScheduleIds: { type: 'array', items: { type: 'number' }, description: 'Class schedule IDs' },
        classIds: { type: 'array', items: { type: 'number' }, description: 'Class IDs' },
        clientIds: { type: 'array', items: { type: 'string' }, description: 'Client IDs' },
      },
    },
    execute: async (args) =>
      getWaitlistEntriesTool(args.classScheduleIds, args.classIds, args.clientIds),
  },
  {
    name: 'substituteClassTeacher',
    description: 'Substitute a teacher for a class',
    inputSchema: {
      type: 'object',
      properties: {
        classId: { type: 'number', description: 'Class ID' },
        originalTeacherId: { type: 'number', description: 'Original teacher ID' },
        substituteTeacherId: { type: 'number', description: 'Substitute teacher ID' },
        substituteTeacherName: { type: 'string', description: 'Substitute teacher name (optional)' },
      },
      required: ['classId', 'originalTeacherId', 'substituteTeacherId'],
    },
    execute: async (args) =>
      substituteClassTeacherTool(
        args.classId,
        args.originalTeacherId,
        args.substituteTeacherId,
        args.substituteTeacherName,
      ),
  },
  {
    name: 'getClassVisits',
    description:
      'Get client visits/attendance for a specific class. Returns all clients who booked or attended the class, including sign-in status, late cancellations, and service information.',
    inputSchema: {
      type: 'object',
      properties: {
        classId: { type: 'number', description: 'The ID of the class to get visits for' },
        lastModifiedDate: { type: 'string', description: 'Only return visits modified after this date (YYYY-MM-DD format)' },
      },
      required: ['classId'],
    },
    execute: async (args) => getClassVisitsTool(args.classId, args.lastModifiedDate),
  },
  {
    name: 'getClients',
    description: 'Search and retrieve clients',
    inputSchema: {
      type: 'object',
      properties: {
        searchText: { type: 'string', description: 'Search text for client name/email/phone' },
        clientIds: { type: 'array', items: { type: 'string' }, description: 'Specific client IDs' },
        lastModifiedDate: { type: 'string', description: 'Get clients modified after this date' },
        isProspect: { type: 'boolean', description: 'Filter for prospects only' },
      },
    },
    execute: async (args) =>
      getClientsTool(args.searchText, args.clientIds, args.lastModifiedDate, args.isProspect),
  },
  {
    name: 'addClient',
    description: 'Add a new client',
    inputSchema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', description: 'First name' },
        lastName: { type: 'string', description: 'Last name' },
        email: { type: 'string', description: 'Email address' },
        mobilePhone: { type: 'string', description: 'Mobile phone' },
        birthDate: { type: 'string', description: 'Birth date in YYYY-MM-DD format' },
        addressLine1: { type: 'string', description: 'Street address' },
        city: { type: 'string', description: 'City' },
        state: { type: 'string', description: 'State/Province' },
        postalCode: { type: 'string', description: 'Postal code' },
        country: { type: 'string', description: 'Country' },
        emergencyContactName: { type: 'string', description: 'Emergency contact name' },
        emergencyContactPhone: { type: 'string', description: 'Emergency contact phone' },
        emergencyContactRelationship: { type: 'string', description: 'Emergency contact relationship' },
        sendAccountEmails: { type: 'boolean', description: 'Send account emails (default true)' },
        referredBy: { type: 'string', description: 'Referral source' },
      },
      required: ['firstName', 'lastName'],
    },
    execute: async (args) =>
      addClientTool(
        args.firstName,
        args.lastName,
        args.email,
        args.mobilePhone,
        args.birthDate,
        args.addressLine1,
        args.city,
        args.state,
        args.postalCode,
        args.country,
        args.emergencyContactName,
        args.emergencyContactPhone,
        args.emergencyContactRelationship,
        args.sendAccountEmails,
        args.referredBy,
      ),
  },
  {
    name: 'updateClient',
    description: 'Update client information',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'Client ID to update' },
        updates: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            email: { type: 'string' },
            mobilePhone: { type: 'string' },
            birthDate: { type: 'string' },
            addressLine1: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            postalCode: { type: 'string' },
            emergencyContactName: { type: 'string' },
            emergencyContactPhone: { type: 'string' },
            sendAccountEmails: { type: 'boolean' },
          },
        },
      },
      required: ['clientId', 'updates'],
    },
    execute: async (args) => updateClientTool(args.clientId, args.updates),
  },
  {
    name: 'getClientVisits',
    description: "Get client's visit/attendance history",
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'Client ID' },
        startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' },
      },
      required: ['clientId'],
    },
    execute: async (args) => getClientVisitsTool(args.clientId, args.startDate, args.endDate),
  },
  {
    name: 'getClientMemberships',
    description: "Get client's active memberships",
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'Client ID' },
        locationId: { type: 'number', description: 'Location ID (optional)' },
      },
      required: ['clientId'],
    },
    execute: async (args) => getClientMembershipsTool(args.clientId, args.locationId),
  },
  {
    name: 'addClientArrival',
    description: 'Check in a client (mark arrival)',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'Client ID' },
        locationId: { type: 'number', description: 'Location ID' },
      },
      required: ['clientId', 'locationId'],
    },
    execute: async (args) => addClientArrivalTool(args.clientId, args.locationId),
  },
  {
    name: 'getClientAccountBalances',
    description: "Get client's account balances",
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'Client ID' },
      },
      required: ['clientId'],
    },
    execute: async (args) => getClientAccountBalancesTool(args.clientId),
  },
  {
    name: 'getClientContracts',
    description: "Get client's contracts/memberships",
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'Client ID' },
      },
      required: ['clientId'],
    },
    execute: async (args) => getClientContractsTool(args.clientId),
  },
  {
    name: 'getServices',
    description: 'Get available services (class packages, memberships)',
    inputSchema: {
      type: 'object',
      properties: {
        programIds: { type: 'array', items: { type: 'number' }, description: 'Program IDs' },
        sessionTypeIds: { type: 'array', items: { type: 'number' }, description: 'Session type IDs' },
        locationId: { type: 'number', description: 'Location ID' },
        classId: { type: 'number', description: 'Class ID' },
        hideRelatedPrograms: { type: 'boolean', description: 'Hide related programs' },
      },
    },
    execute: async (args) =>
      getServicesTool(
        args.programIds,
        args.sessionTypeIds,
        args.locationId,
        args.classId,
        args.hideRelatedPrograms,
      ),
  },
  {
    name: 'getPackages',
    description: 'Get class packages',
    inputSchema: {
      type: 'object',
      properties: {
        locationId: { type: 'number', description: 'Location ID' },
        classScheduleId: { type: 'number', description: 'Class schedule ID' },
      },
    },
    execute: async (args) => getPackagesTool(args.locationId, args.classScheduleId),
  },
  {
    name: 'getProducts',
    description: 'Get retail products',
    inputSchema: {
      type: 'object',
      properties: {
        productIds: { type: 'array', items: { type: 'number' }, description: 'Product IDs' },
        searchText: { type: 'string', description: 'Search text' },
        categoryIds: { type: 'array', items: { type: 'string' }, description: 'Category IDs' },
        subCategoryIds: { type: 'array', items: { type: 'string' }, description: 'Subcategory IDs' },
        sellOnline: { type: 'boolean', description: 'Filter for online products' },
      },
    },
    execute: async (args) =>
      getProductsTool(
        args.productIds,
        args.searchText,
        args.categoryIds,
        args.subCategoryIds,
        args.sellOnline,
      ),
  },
  {
    name: 'getContracts',
    description: 'Get available contracts/memberships',
    inputSchema: {
      type: 'object',
      properties: {
        contractIds: { type: 'array', items: { type: 'number' }, description: 'Contract IDs' },
        soldOnline: { type: 'boolean', description: 'Filter for online contracts' },
        locationId: { type: 'number', description: 'Location ID' },
      },
    },
    execute: async (args) => getContractsTool(args.contractIds, args.soldOnline, args.locationId),
  },
  {
    name: 'checkoutShoppingCart',
    description: 'Process a shopping cart checkout',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'Client ID' },
        items: {
          type: 'array',
          description: 'Cart items',
          items: {
            type: 'object',
            properties: {
              item: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['Service', 'Product', 'Package', 'Tip'] },
                  metadata: { type: 'object' },
                },
              },
              quantity: { type: 'number' },
            },
          },
        },
        payments: {
          type: 'array',
          description: 'Payment methods',
          items: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['Cash', 'Check', 'CreditCard', 'Comp', 'Custom', 'StoredCard'],
              },
              metadata: { type: 'object' },
            },
          },
        },
        inStore: { type: 'boolean', description: 'In-store purchase' },
        promotionCode: { type: 'string', description: 'Promotion code' },
        sendEmail: { type: 'boolean', description: 'Send email receipt' },
        locationId: { type: 'number', description: 'Location ID' },
      },
      required: ['clientId', 'items', 'payments'],
    },
    execute: async (args) =>
      checkoutShoppingCartTool(
        args.clientId,
        args.items,
        args.payments,
        args.inStore,
        args.promotionCode,
        args.sendEmail,
        args.locationId,
      ),
  },
  {
    name: 'purchaseContract',
    description: 'Purchase a contract/membership',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'Client ID' },
        contractId: { type: 'number', description: 'Contract ID' },
        startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        firstPaymentOccurs: {
          type: 'string',
          enum: ['StartDate', 'UponSale', 'BillingDate'],
        },
        clientSignature: { type: 'string', description: 'Client signature' },
        promotionCode: { type: 'string', description: 'Promotion code' },
        locationId: { type: 'number', description: 'Location ID' },
      },
      required: ['clientId', 'contractId', 'startDate'],
    },
    execute: async (args) =>
      purchaseContractTool(
        args.clientId,
        args.contractId,
        args.startDate,
        args.firstPaymentOccurs,
        args.clientSignature,
        args.promotionCode,
        args.locationId,
      ),
  },
  {
    name: 'getSites',
    description: 'Get site information',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => getSitesTool(),
  },
  {
    name: 'getLocations',
    description: 'Get all studio locations',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => getLocationsTool(),
  },
  {
    name: 'getPrograms',
    description: 'Get programs offered (yoga, pilates, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        scheduleType: { type: 'string', enum: ['All', 'Class', 'Enrollment', 'Appointment'] },
        onlineOnly: { type: 'boolean', description: 'Online booking only' },
      },
    },
    execute: async (args) => getProgramsTool(args.scheduleType, args.onlineOnly),
  },
  {
    name: 'getResources',
    description: 'Get resources (rooms, equipment, etc.)',
    inputSchema: {
      type: 'object',
      properties: {
        sessionTypeIds: { type: 'array', items: { type: 'number' }, description: 'Session type IDs' },
        locationId: { type: 'number', description: 'Location ID' },
        startDateTime: { type: 'string', description: 'Start date/time' },
        endDateTime: { type: 'string', description: 'End date/time' },
      },
    },
    execute: async (args) =>
      getResourcesTool(args.sessionTypeIds, args.locationId, args.startDateTime, args.endDateTime),
  },
  {
    name: 'getSessionTypes',
    description: 'Get session types (class types, appointment types)',
    inputSchema: {
      type: 'object',
      properties: {
        programIds: { type: 'array', items: { type: 'number' }, description: 'Program IDs' },
        onlineOnly: { type: 'boolean', description: 'Online booking only' },
      },
    },
    execute: async (args) => getSessionTypesTool(args.programIds, args.onlineOnly),
  },
  {
    name: 'getActivationCode',
    description: 'Get activation code for the site',
    inputSchema: { type: 'object', properties: {} },
    execute: async () => getActivationCodeTool(),
  },
  {
    name: 'getStaffAppointments',
    description: 'Get appointments for staff',
    inputSchema: {
      type: 'object',
      properties: {
        staffIds: { type: 'array', items: { type: 'number' }, description: 'Staff IDs' },
        locationIds: { type: 'array', items: { type: 'number' }, description: 'Location IDs' },
        startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' },
        appointmentIds: { type: 'array', items: { type: 'number' }, description: 'Appointment IDs' },
        clientIds: { type: 'array', items: { type: 'string' }, description: 'Client IDs' },
      },
      required: ['staffIds'],
    },
    execute: async (args) =>
      getStaffAppointmentsTool(
        args.staffIds,
        args.locationIds,
        args.startDate,
        args.endDate,
        args.appointmentIds,
        args.clientIds,
      ),
  },
  {
    name: 'addAppointment',
    description: 'Book a new appointment',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'Client ID' },
        staffId: { type: 'number', description: 'Staff ID' },
        locationId: { type: 'number', description: 'Location ID' },
        sessionTypeId: { type: 'number', description: 'Session type ID' },
        startDateTime: { type: 'string', description: 'Start date/time in ISO format' },
        resourceIds: { type: 'array', items: { type: 'number' }, description: 'Resource IDs' },
        notes: { type: 'string', description: 'Appointment notes' },
        staffRequested: { type: 'boolean', description: 'Specific staff requested' },
        executePayment: { type: 'boolean', description: 'Process payment' },
        sendEmail: { type: 'boolean', description: 'Send confirmation email' },
        applyPayment: { type: 'boolean', description: 'Apply client credit/payment' },
      },
      required: ['clientId', 'staffId', 'locationId', 'sessionTypeId', 'startDateTime'],
    },
    execute: async (args) =>
      addAppointmentTool(
        args.clientId,
        args.staffId,
        args.locationId,
        args.sessionTypeId,
        args.startDateTime,
        args.resourceIds,
        args.notes,
        args.staffRequested,
        args.executePayment,
        args.sendEmail,
        args.applyPayment,
      ),
  },
  {
    name: 'updateAppointment',
    description: 'Update an existing appointment',
    inputSchema: {
      type: 'object',
      properties: {
        appointmentId: { type: 'number', description: 'Appointment ID' },
        staffId: { type: 'number', description: 'New staff ID' },
        startDateTime: { type: 'string', description: 'New start date/time' },
        endDateTime: { type: 'string', description: 'New end date/time' },
        resourceIds: { type: 'array', items: { type: 'number' }, description: 'Resource IDs' },
        notes: { type: 'string', description: 'Appointment notes' },
        executePayment: { type: 'boolean', description: 'Process payment' },
        sendEmail: { type: 'boolean', description: 'Send update email' },
        applyPayment: { type: 'boolean', description: 'Apply client credit/payment' },
      },
      required: ['appointmentId'],
    },
    execute: async (args) =>
      updateAppointmentTool(
        args.appointmentId,
        args.staffId,
        args.startDateTime,
        args.endDateTime,
        args.resourceIds,
        args.notes,
        args.executePayment,
        args.sendEmail,
        args.applyPayment,
      ),
  },
  {
    name: 'getBookableItems',
    description: 'Get available appointment slots/bookable items',
    inputSchema: {
      type: 'object',
      properties: {
        sessionTypeIds: { type: 'array', items: { type: 'number' }, description: 'Session type IDs' },
        locationIds: { type: 'array', items: { type: 'number' }, description: 'Location IDs' },
        staffIds: { type: 'array', items: { type: 'number' }, description: 'Staff IDs' },
        startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' },
        appointmentId: { type: 'number', description: 'Existing appointment ID for rescheduling' },
      },
      required: ['sessionTypeIds'],
    },
    execute: async (args) =>
      getBookableItemsTool(
        args.sessionTypeIds,
        args.locationIds,
        args.staffIds,
        args.startDate,
        args.endDate,
        args.appointmentId,
      ),
  },
  {
    name: 'getActiveSessionTimes',
    description: 'Get active session times/availability windows',
    inputSchema: {
      type: 'object',
      properties: {
        scheduleType: { type: 'string', enum: ['All', 'Class', 'Enrollment', 'Appointment'] },
        sessionTypeIds: { type: 'array', items: { type: 'number' }, description: 'Session type IDs' },
        startTime: { type: 'string', description: 'Start time (HH:mm:ss)' },
        endTime: { type: 'string', description: 'End time (HH:mm:ss)' },
        days: { type: 'array', items: { type: 'string' }, description: 'Days of the week' },
      },
    },
    execute: async (args) =>
      getActiveSessionTimesTool(
        args.scheduleType,
        args.sessionTypeIds,
        args.startTime,
        args.endTime,
        args.days,
      ),
  },
  {
    name: 'getScheduleItems',
    description: 'Get schedule items/appointments in a date range',
    inputSchema: {
      type: 'object',
      properties: {
        locationIds: { type: 'array', items: { type: 'number' }, description: 'Location IDs' },
        staffIds: { type: 'array', items: { type: 'number' }, description: 'Staff IDs' },
        startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' },
        ignorePrepFinishBuffer: { type: 'boolean', description: 'Ignore prep/finish buffer times' },
      },
    },
    execute: async (args) =>
      getScheduleItemsTool(
        args.locationIds,
        args.staffIds,
        args.startDate,
        args.endDate,
        args.ignorePrepFinishBuffer,
      ),
  },
  {
    name: 'getEnrollments',
    description: 'Get enrollments/courses/workshops',
    inputSchema: {
      type: 'object',
      properties: {
        locationIds: { type: 'array', items: { type: 'number' }, description: 'Location IDs' },
        classScheduleIds: { type: 'array', items: { type: 'number' }, description: 'Class schedule IDs' },
        staffIds: { type: 'array', items: { type: 'number' }, description: 'Staff IDs' },
        programIds: { type: 'array', items: { type: 'number' }, description: 'Program IDs' },
        sessionTypeIds: { type: 'array', items: { type: 'number' }, description: 'Session type IDs' },
        semesterIds: { type: 'array', items: { type: 'number' }, description: 'Semester IDs' },
        courseIds: { type: 'array', items: { type: 'number' }, description: 'Course IDs' },
        startDate: { type: 'string', description: 'Start date in YYYY-MM-DD format' },
        endDate: { type: 'string', description: 'End date in YYYY-MM-DD format' },
      },
    },
    execute: async (args) =>
      getEnrollmentsTool(
        args.locationIds,
        args.classScheduleIds,
        args.staffIds,
        args.programIds,
        args.sessionTypeIds,
        args.semesterIds,
        args.courseIds,
        args.startDate,
        args.endDate,
      ),
  },
  {
    name: 'addClientToEnrollment',
    description: 'Add/register a client to an enrollment',
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'Client ID' },
        classScheduleIds: { type: 'array', items: { type: 'number' }, description: 'Class schedule IDs' },
        enrollmentDateForward: { type: 'string', description: 'Enroll forward from this date' },
        enrollmentDates: { type: 'array', items: { type: 'string' }, description: 'Specific enrollment dates' },
        enroll: { type: 'boolean', description: 'Whether to enroll (default true)' },
        waitlist: { type: 'boolean', description: 'Add to waitlist if full' },
        sendEmail: { type: 'boolean', description: 'Send email notification' },
        testMode: { type: 'boolean', description: 'Validate without saving' },
      },
      required: ['clientId', 'classScheduleIds'],
    },
    execute: async (args) =>
      addClientToEnrollmentTool(
        args.clientId,
        args.classScheduleIds,
        args.enrollmentDateForward,
        args.enrollmentDates,
        args.enroll,
        args.waitlist,
        args.sendEmail,
        args.testMode,
      ),
  },
  {
    name: 'getClientEnrollments',
    description: "Get client's enrollments",
    inputSchema: {
      type: 'object',
      properties: {
        clientId: { type: 'string', description: 'Client ID' },
      },
      required: ['clientId'],
    },
    execute: async (args) => getClientEnrollmentsTool(args.clientId),
  },
] as const;

export function registerMindbodyTools(server: FastMCP<undefined>): void {
  for (const tool of mindbodyToolDefinitions) {
    server.addTool({
      name: tool.name,
      description: tool.description,
      parameters: schemaToZod(tool.inputSchema, true),
      execute: async (args, context) => {
        try {
          const result = await withMindbodyExecution(context.extraArgs, () => tool.execute(args));
          return stringifyResult(result);
        } catch (error) {
          throw toUserError(error, tool.name);
        }
      },
    });
  }
}
