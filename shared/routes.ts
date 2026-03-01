import { z } from 'zod';
import { 
  insertUserSchema, 
  insertPatientSchema, 
  insertAppointmentSchema, 
  insertMedicalRecordSchema,
  users,
  patients,
  appointments,
  medicalRecords
} from './schema';

// === SHARED ERROR SCHEMAS ===
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

// === API CONTRACT ===
export const api = {
  // --- AUTH ---
  auth: {
    login: {
      method: 'POST' as const,
      path: '/api/login',
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: 'POST' as const,
      path: '/api/logout',
      responses: {
        200: z.void(),
      },
    },
    me: {
      method: 'GET' as const,
      path: '/api/user',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },

  // --- LICENSE ---
  license: {
    status: {
      method: 'GET' as const,
      path: '/api/license/status',
      responses: {
        200: z.object({
          active: z.boolean(),
          expiresAt: z.number().nullable(),
          issuedAt: z.number().nullable(),
          daysRemaining: z.number().nullable(),
          keyHint: z.string().nullable(),
        }),
      },
    },
    activate: {
      method: 'POST' as const,
      path: '/api/license/activate',
      input: z.object({
        key: z.string().min(10),
      }),
      responses: {
        200: z.object({
          active: z.boolean(),
          expiresAt: z.number(),
          issuedAt: z.number(),
          daysRemaining: z.number(),
        }),
        400: errorSchemas.validation,
      },
    },
  },

  // --- USERS (Admin/Doctors) ---
  users: {
    list: {
      method: 'GET' as const,
      path: '/api/users',
      input: z.object({
        role: z.enum(['admin', 'operator', 'doctor']).optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/users/:id',
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/users',
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/users/:id',
      input: insertUserSchema.partial(),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/users/:id',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },

  // --- PATIENTS ---
  patients: {
    list: {
      method: 'GET' as const,
      path: '/api/patients',
      input: z.object({
        search: z.string().optional(),
        page: z.coerce.number().optional(),
        pageSize: z.coerce.number().optional(),
        sortBy: z.enum(['name', 'createdAt', 'birthDate', 'nextAppointmentAt']).optional(),
        sortDir: z.enum(['asc', 'desc']).optional(),
        gender: z.string().optional(),
        ageMin: z.coerce.number().optional(),
        ageMax: z.coerce.number().optional(),
        hasAppointmentToday: z.coerce.boolean().optional(),
        missingPhone: z.coerce.boolean().optional(),
        missingEmail: z.coerce.boolean().optional(),
        includeArchived: z.coerce.boolean().optional(),
        onlyArchived: z.coerce.boolean().optional(),
      }).optional(),
      responses: {
        200: z.object({
          items: z.array(z.custom<typeof patients.$inferSelect & {
            hasAppointmentToday?: boolean;
            nextAppointmentAt?: string | null;
          }>()),
          total: z.number(),
          page: z.number(),
          pageSize: z.number(),
        }),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/patients/:id',
      responses: {
        200: z.custom<typeof patients.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/patients',
      input: insertPatientSchema,
      responses: {
        201: z.custom<typeof patients.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/patients/:id',
      input: insertPatientSchema.partial(),
      responses: {
        200: z.custom<typeof patients.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    archive: {
      method: 'PATCH' as const,
      path: '/api/patients/:id/archive',
      input: z.object({
        archived: z.boolean(),
      }),
      responses: {
        200: z.custom<typeof patients.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    hardDelete: {
      method: 'DELETE' as const,
      path: '/api/patients/:id/hard',
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
    export: {
      method: 'GET' as const,
      path: '/api/patients/export',
      input: z.object({
        search: z.string().optional(),
        gender: z.string().optional(),
        ageMin: z.coerce.number().optional(),
        ageMax: z.coerce.number().optional(),
        hasAppointmentToday: z.coerce.boolean().optional(),
        missingPhone: z.coerce.boolean().optional(),
        missingEmail: z.coerce.boolean().optional(),
        includeArchived: z.coerce.boolean().optional(),
        onlyArchived: z.coerce.boolean().optional(),
      }).optional(),
      responses: {
        200: z.string(),
      },
    },
  },

  // --- APPOINTMENTS ---
  appointments: {
    list: {
      method: 'GET' as const,
      path: '/api/appointments',
      input: z.object({
        date: z.string().optional(),
        doctorId: z.coerce.number().optional(),
        status: z.string().optional(),
      }).optional(),
      responses: {
        200: z.array(z.custom<typeof appointments.$inferSelect & { patient: typeof patients.$inferSelect, doctor: typeof users.$inferSelect }>()),
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/appointments',
      input: insertAppointmentSchema,
      responses: {
        201: z.custom<typeof appointments.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/appointments/:id',
      input: insertAppointmentSchema.partial(),
      responses: {
        200: z.custom<typeof appointments.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    updateStatus: {
      method: 'PATCH' as const,
      path: '/api/appointments/:id/status',
      input: z.object({ 
        status: z.string(),
        paymentMethod: z.string().optional(),
        paymentStatus: z.string().optional(),
        price: z.number().optional(),
        type: z.string().optional(),
        examType: z.string().optional(),
      }),
      responses: {
        200: z.custom<typeof appointments.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },

  // --- MEDICAL RECORDS ---
  medicalRecords: {
    listByPatient: {
      method: 'GET' as const,
      path: '/api/patients/:patientId/records',
      responses: {
        200: z.array(z.custom<typeof medicalRecords.$inferSelect & { doctor: typeof users.$inferSelect }>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/records/:id',
      responses: {
        200: z.custom<typeof medicalRecords.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/records',
      input: insertMedicalRecordSchema,
      responses: {
        201: z.custom<typeof medicalRecords.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: 'PUT' as const,
      path: '/api/records/:id',
      input: insertMedicalRecordSchema.partial(),
      responses: {
        200: z.custom<typeof medicalRecords.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },

  // Multi-clinic (SaaS) endpoints removed: single-tenant installation.
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
