import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";
import { 
  db 
} from "./db";
import { 
  users, patients, appointments, medicalRecords, clinics, availabilityExceptions,
  inventory, inventoryTransactions, tissBills, digitalSignatures, medicalRecordLogs,
  type User, type InsertUser, type Patient, type InsertPatient,
  type Appointment, type InsertAppointment, type MedicalRecord, type InsertMedicalRecord,
  type Clinic, type InsertClinic, type AvailabilityException, type InsertAvailabilityException,
  type Inventory, type InsertInventory, type InventoryTransaction, type InsertInventoryTransaction,
  type TissBill, type InsertTissBill, type DigitalSignature, type InsertDigitalSignature,
  type MedicalRecordLog, type InsertMedicalRecordLog,
  type MedicalRecordWithDetails
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import session from "express-session";
import connectSqlite3 from "connect-sqlite3";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);
const SQLiteStore = connectSqlite3(session);

export interface IStorage {
  sessionStore: session.Store;
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUsersByClinic(clinicId: number, role?: string): Promise<User[]>;
  getDoctorsByClinic(clinicId: number): Promise<Partial<User>[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;
  hardDeleteUser(id: number, clinicId: number): Promise<void>;

  // Patients
  getPatients(
    clinicId: number,
    params?: {
      search?: string;
      page?: number;
      pageSize?: number;
      sortBy?: "name" | "createdAt" | "birthDate" | "nextAppointmentAt";
      sortDir?: "asc" | "desc";
      gender?: string;
      ageMin?: number;
      ageMax?: number;
      hasAppointmentToday?: boolean;
      missingPhone?: boolean;
      missingEmail?: boolean;
      includeArchived?: boolean;
      onlyArchived?: boolean;
    }
  ): Promise<{ items: Array<Patient & { hasAppointmentToday?: boolean; nextAppointmentAt?: string | null }>; total: number; page: number; pageSize: number }>;
  getPatient(id: number, clinicId: number): Promise<Patient | undefined>;
  createPatient(patient: InsertPatient): Promise<Patient>;
  updatePatient(id: number, patient: Partial<InsertPatient>): Promise<Patient>;
  archivePatient(id: number, clinicId: number, archived: boolean): Promise<Patient>;
  hardDeletePatient(id: number, clinicId: number): Promise<void>;
  exportPatientsCsv(
    clinicId: number,
    params?: {
      search?: string;
      gender?: string;
      ageMin?: number;
      ageMax?: number;
      hasAppointmentToday?: boolean;
      missingPhone?: boolean;
      missingEmail?: boolean;
      includeArchived?: boolean;
      onlyArchived?: boolean;
    }
  ): Promise<string>;

  // Appointments
  getAppointments(clinicId: number, filters?: { date?: string; startDate?: string; endDate?: string; doctorId?: number; status?: string; patientId?: number }): Promise<(Appointment & { patient: Patient; doctor: User })[]>;
  getAppointment(id: number, clinicId: number): Promise<Appointment | undefined>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: number, clinicId: number, appointment: Partial<Appointment>): Promise<Appointment>;
  updateAppointmentStatus(id: number, status: string, paymentDetails?: { method?: string, status?: string, price?: number, type?: string, examType?: string }): Promise<Appointment>;
  deleteAppointment(id: number): Promise<void>;

  // Availability
  getAvailabilityExceptions(clinicId: number, doctorId?: number, date?: string): Promise<AvailabilityException[]>;
  createAvailabilityException(exception: InsertAvailabilityException): Promise<AvailabilityException>;
  deleteAvailabilityException(id: number): Promise<void>;
  checkAvailability(clinicId: number, doctorId: number, date: string): Promise<boolean>;

  // Medical Records
  getMedicalRecords(patientId: number, clinicId: number): Promise<MedicalRecordWithDetails[]>;
  getMedicalRecord(id: number, clinicId: number): Promise<MedicalRecordWithDetails | undefined>;
  createMedicalRecord(record: InsertMedicalRecord): Promise<MedicalRecord>;
  updateMedicalRecord(id: number, record: Partial<InsertMedicalRecord>): Promise<MedicalRecord>;
  
  // Inventory
  getInventory(clinicId: number): Promise<Inventory[]>;
  createInventoryItem(item: InsertInventory): Promise<Inventory>;
  updateInventoryItem(id: number, item: Partial<Inventory>): Promise<Inventory>;
  createInventoryTransaction(transaction: InsertInventoryTransaction): Promise<InventoryTransaction>;

  // TISS
  getTissBills(clinicId: number): Promise<TissBill[]>;
  createTissBill(bill: InsertTissBill): Promise<TissBill>;

  // Digital Signature
  createDigitalSignature(signature: InsertDigitalSignature): Promise<DigitalSignature>;
  getSignaturesByRecord(recordId: number): Promise<DigitalSignature[]>;

  // Triage
  updateTriage(appointmentId: number, triageData: any): Promise<Appointment>;

  // Audit Logs
  createMedicalRecordLog(log: InsertMedicalRecordLog): Promise<MedicalRecordLog>;
  getMedicalRecordLogs(medicalRecordId: number): Promise<MedicalRecordLog[]>;

  // Clinics
  getClinics(): Promise<Clinic[]>;
  getClinic(id: number): Promise<Clinic | undefined>;
  createClinic(clinic: InsertClinic): Promise<Clinic>;
  updateClinic(id: number, clinic: Partial<InsertClinic>): Promise<Clinic>;
  deleteClinic(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    const isProduction = process.env.NODE_ENV === "production";
    const preferSqlite = process.env.SESSION_STORE === "sqlite" || isProduction;

    if (preferSqlite) {
      // Persist sessions on disk (recommended for production / restarts)
      const dbPath = process.env.DB_PATH ? path.resolve(process.env.DB_PATH) : path.join(process.cwd(), "data", "sqlite.db");
      const sessionsDir = path.dirname(dbPath);
      try { fs.mkdirSync(sessionsDir, { recursive: true }); } catch {}
      this.sessionStore = new SQLiteStore({
        dir: sessionsDir,
        db: "sessions.sqlite",
        table: "sessions",
      });
    } else {
      // In-memory store for local dev
      this.sessionStore = new MemoryStore({
        checkPeriod: 86400000 // prune expired entries every 24h
      });
    }
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUsersByClinic(clinicId: number, role?: string, includeInactive?: boolean): Promise<User[]> {
    let conditions = [eq(users.clinicId, clinicId)];
    if (role) {
      conditions.push(eq(users.role, role));
    }
    if (!includeInactive) {
      conditions.push(eq(users.isActive, true));
    }
    return await db.select().from(users).where(and(...conditions));
  }

  async getDoctorsByClinic(clinicId: number): Promise<Partial<User>[]> {
    return await db.select({
      id: users.id,
      name: users.name,
      username: users.username,
      specialty: users.specialty,
      professionalCouncilType: users.professionalCouncilType,
      professionalCouncilNumber: users.professionalCouncilNumber,
      professionalCouncilState: users.professionalCouncilState,
    })
    .from(users)
    .where(and(
      eq(users.clinicId, clinicId), 
      eq(users.role, 'doctor'),
      eq(users.isActive, true)
    ));
  }

  async createUser(user: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const [newUser] = await db.insert(users).values({ ...user, password: hashedPassword }).returning();
    return newUser;
  }

  async updateUser(id: number, user: Partial<InsertUser>): Promise<User> {
    const updateData = { ...user };
    if (updateData.password && !updateData.password.startsWith("$2")) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    const [updated] = await db.update(users).set(updateData).where(eq(users.id, id)).returning();
    return updated;
  }

  async deleteUser(id: number): Promise<void> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    if (user) {
      await db.update(users).set({ isActive: !user.isActive }).where(eq(users.id, id));
    }
  }

  async hardDeleteUser(id: number, clinicId: number): Promise<void> {
    const [user] = await db.select().from(users).where(and(eq(users.id, id), eq(users.clinicId, clinicId)));
    if (!user) {
      throw new Error("Usuário não encontrado nesta clínica");
    }

    // Check for critical links
    const hasAppointments = (await db.select({ value: sql`count(*)` }).from(appointments).where(eq(appointments.doctorId, id)))[0].value > 0;
    const hasRecords = (await db.select({ value: sql`count(*)` }).from(medicalRecords).where(eq(medicalRecords.doctorId, id)))[0].value > 0;
    const hasSignatures = (await db.select({ value: sql`count(*)` }).from(digitalSignatures).where(eq(digitalSignatures.doctorId, id)))[0].value > 0;
    const hasLogs = (await db.select({ value: sql`count(*)` }).from(medicalRecordLogs).where(eq(medicalRecordLogs.userId, id)))[0].value > 0;
    const hasAvailability = (await db.select({ value: sql`count(*)` }).from(availabilityExceptions).where(eq(availabilityExceptions.doctorId, id)))[0].value > 0;

    if (hasAppointments || hasRecords || hasSignatures || hasLogs || hasAvailability) {
      throw new Error("Usuário possui registros vinculados. Apenas desativação é permitida.");
    }

    await db.delete(users).where(eq(users.id, id));
  }

  async getPatients(
    clinicId: number,
    params?: {
      search?: string;
      page?: number;
      pageSize?: number;
      sortBy?: "name" | "createdAt" | "birthDate" | "nextAppointmentAt";
      sortDir?: "asc" | "desc";
      gender?: string;
      ageMin?: number;
      ageMax?: number;
      hasAppointmentToday?: boolean;
      missingPhone?: boolean;
      missingEmail?: boolean;
      includeArchived?: boolean;
      onlyArchived?: boolean;
    }
  ): Promise<{ items: Array<Patient & { hasAppointmentToday?: boolean; nextAppointmentAt?: string | null }>; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, params?.page || 1);
    const pageSize = Math.min(100, Math.max(5, params?.pageSize || 10));
    const sortBy = params?.sortBy || "name";
    const sortDir = params?.sortDir || "asc";

    const conditions: any[] = [eq(patients.clinicId, clinicId)];

    // Archived handling
    if (params?.onlyArchived) {
      conditions.push(eq(patients.isArchived, true));
    } else if (!params?.includeArchived) {
      conditions.push(eq(patients.isArchived, false));
    }

    const search = params?.search?.trim();
    if (search) {
      const like = `%${search}%`;
      conditions.push(sql`(
        ${patients.name} LIKE ${like}
        OR ${patients.cpf} LIKE ${like}
        OR ${patients.phone} LIKE ${like}
        OR ${patients.email} LIKE ${like}
      )`);
    }

    if (params?.gender) {
      conditions.push(eq(patients.gender, params.gender));
    }

    // Missing contact filters (push down to SQL)
    if (params?.missingPhone) {
      conditions.push(sql`(${patients.phone} IS NULL OR trim(${patients.phone}) = '')`);
    }
    if (params?.missingEmail) {
      conditions.push(sql`(${patients.email} IS NULL OR trim(${patients.email}) = '')`);
    }

    // Age filters (birthDate stored as YYYY-MM-DD) - convert to birthDate range and filter in SQL
    const toIsoDate = (d: Date) => d.toISOString().slice(0, 10);
    const shiftYears = (d: Date, years: number) => {
      const copy = new Date(d.getTime());
      copy.setFullYear(copy.getFullYear() + years);
      return copy;
    };
    const shiftDays = (d: Date, days: number) => {
      const copy = new Date(d.getTime());
      copy.setDate(copy.getDate() + days);
      return copy;
    };

    const today = new Date();
    const todayStr = toIsoDate(today);

    if (params?.ageMin !== undefined) {
      // age >= ageMin  => birthDate <= today - ageMin years
      const cutoffMaxBirthDate = toIsoDate(shiftYears(today, -params.ageMin));
      conditions.push(sql`${patients.birthDate} <= ${cutoffMaxBirthDate}`);
    }
    if (params?.ageMax !== undefined) {
      // age <= ageMax => birthDate >= (today - (ageMax+1) years) + 1 day
      const cutoffMinBirthDate = toIsoDate(shiftDays(shiftYears(today, -(params.ageMax + 1)), 1));
      conditions.push(sql`${patients.birthDate} >= ${cutoffMinBirthDate}`);
    }

    // Appointment-derived computed fields (SQL subqueries)
    const hasAppointmentTodayExpr = sql<number>`EXISTS (
      SELECT 1
      FROM appointments a
      WHERE a.clinic_id = ${clinicId}
        AND a.patient_id = ${patients.id}
        AND a.status != 'cancelado'
        AND a.date = ${todayStr}
    )`;

    const nextAppointmentAtExpr = sql<string | null>`(
      SELECT MIN(a.date || 'T' || a.start_time || ':00')
      FROM appointments a
      WHERE a.clinic_id = ${clinicId}
        AND a.patient_id = ${patients.id}
        AND a.status != 'cancelado'
        AND a.date >= ${todayStr}
    )`;

    if (params?.hasAppointmentToday !== undefined) {
      conditions.push(sql`${hasAppointmentTodayExpr} = ${params.hasAppointmentToday ? 1 : 0}`);
    }

    // Total count (for pagination UI)
    const totalRow = await db
      .select({ value: sql<number>`count(*)` })
      .from(patients)
      .where(and(...conditions));
    const total = Number(totalRow[0]?.value ?? 0);

    // Sorting (push down to SQL when possible)
    const dirKeyword = sortDir === "desc" ? sql`DESC` : sql`ASC`;
    const orderByExpr =
      sortBy === "createdAt"
        ? sql`${patients.createdAt} ${dirKeyword}`
        : sortBy === "birthDate"
          ? sql`${patients.birthDate} ${dirKeyword}`
          : sortBy === "nextAppointmentAt"
            // Nulls last: (expr IS NULL) ASC, then expr ASC/DESC
            ? sql`(${nextAppointmentAtExpr} IS NULL) ASC, ${nextAppointmentAtExpr} ${dirKeyword}`
            : sql`${patients.name} ${dirKeyword}`;

    const offset = (page - 1) * pageSize;

    const rows = await db
      .select({
        ...patients,
        hasAppointmentToday: hasAppointmentTodayExpr,
        nextAppointmentAt: nextAppointmentAtExpr,
      })
      .from(patients)
      .where(and(...conditions))
      .orderBy(orderByExpr)
      .limit(pageSize)
      .offset(offset);

    // Drizzle may return 0/1 for EXISTS depending on driver; normalize to boolean.
    const items = rows.map((r: any) => ({
      ...(r as Patient),
      hasAppointmentToday: Boolean(r.hasAppointmentToday),
      nextAppointmentAt: r.nextAppointmentAt ?? null,
    }));

    return { items, total, page, pageSize };
  }

  async getPatient(id: number, clinicId: number): Promise<Patient | undefined> {
    const [patient] = await db.select().from(patients).where(and(eq(patients.id, id), eq(patients.clinicId, clinicId)));
    return patient;
  }

  async createPatient(patient: InsertPatient): Promise<Patient> {
    const [newPatient] = await db.insert(patients).values(patient).returning();
    return newPatient;
  }

  async updatePatient(id: number, patient: Partial<InsertPatient>): Promise<Patient> {
    const [updated] = await db.update(patients).set(patient).where(eq(patients.id, id)).returning();
    return updated;
  }

  async archivePatient(id: number, clinicId: number, archived: boolean): Promise<Patient> {
    const existing = await this.getPatient(id, clinicId);
    if (!existing) throw new Error("Paciente não encontrado");
    const [updated] = await db
      .update(patients)
      .set({
        isArchived: archived,
        archivedAt: archived ? new Date().toISOString() : null,
      } as any)
      .where(and(eq(patients.id, id), eq(patients.clinicId, clinicId)))
      .returning();
    return updated;
  }

  async hardDeletePatient(id: number, clinicId: number): Promise<void> {
    const existing = await this.getPatient(id, clinicId);
    if (!existing) throw new Error("Paciente não encontrado");

    const hasAppointments = (await db.select({ value: sql`count(*)` }).from(appointments).where(eq(appointments.patientId, id)))[0].value > 0;
    const hasRecords = (await db.select({ value: sql`count(*)` }).from(medicalRecords).where(eq(medicalRecords.patientId, id)))[0].value > 0;
    if (hasAppointments || hasRecords) {
      throw new Error("Paciente possui registros vinculados. Use arquivamento.");
    }

    await db.delete(patients).where(and(eq(patients.id, id), eq(patients.clinicId, clinicId)));
  }

  async exportPatientsCsv(
    clinicId: number,
    params?: {
      search?: string;
      gender?: string;
      ageMin?: number;
      ageMax?: number;
      hasAppointmentToday?: boolean;
      missingPhone?: boolean;
      missingEmail?: boolean;
      includeArchived?: boolean;
      onlyArchived?: boolean;
    }
  ): Promise<string> {
    const result = await this.getPatients(clinicId, { ...params, page: 1, pageSize: 100000 });
    const header = [
      "id",
      "name",
      "cpf",
      "birthDate",
      "phone",
      "email",
      "gender",
      "address",
      "isArchived",
      "hasAppointmentToday",
      "nextAppointmentAt",
    ];
    const escape = (v: any) => {
      const s = (v ?? "").toString();
      if (s.includes(",") || s.includes("\n") || s.includes('"')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const lines = [header.join(",")];
    for (const p of result.items) {
      lines.push(
        [
          p.id,
          p.name,
          p.cpf,
          p.birthDate,
          p.phone,
          p.email,
          p.gender,
          p.address,
          p.isArchived ? 1 : 0,
          (p as any).hasAppointmentToday ? 1 : 0,
          (p as any).nextAppointmentAt || "",
        ].map(escape).join(",")
      );
    }
    return lines.join("\n");
  }

  async getAppointments(clinicId: number, filters?: { date?: string; startDate?: string; endDate?: string; doctorId?: number; status?: string; patientId?: number }): Promise<(Appointment & { patient: Patient; doctor: User })[]> {
    let conditions = [eq(appointments.clinicId, clinicId)];
    
    if (filters?.date) {
      conditions.push(eq(appointments.date, filters.date));
    } else if (filters?.startDate && filters?.endDate) {
      conditions.push(sql`date >= ${filters.startDate} AND date <= ${filters.endDate}`);
    }

    if (filters?.doctorId) {
      conditions.push(eq(appointments.doctorId, filters.doctorId));
    }

    if (filters?.patientId) {
      conditions.push(eq(appointments.patientId, filters.patientId));
    }

    if (filters?.status) {
      conditions.push(eq(appointments.status, filters.status));
    }

    const results = await db.select().from(appointments).where(and(...conditions));
    const enriched = await Promise.all(results.map(async (apt) => {
      const [patient] = await db.select().from(patients).where(eq(patients.id, apt.patientId));
      const [doctorData] = await db.select().from(users).where(eq(users.id, apt.doctorId));
      const { password, ...doctor } = doctorData;
      return { ...apt, patient, doctor } as (Appointment & { patient: Patient; doctor: User });
    }));

    return enriched;
  }

  async getAppointment(id: number, clinicId: number): Promise<Appointment | undefined> {
    const [apt] = await db.select().from(appointments).where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId)));
    return apt;
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const [newApt] = await db.insert(appointments).values(appointment).returning();
    return newApt;
  }

  async updateAppointment(id: number, clinicId: number, appointment: Partial<Appointment>): Promise<Appointment> {
    const [updated] = await db.update(appointments)
      .set(appointment)
      .where(and(eq(appointments.id, id), eq(appointments.clinicId, clinicId)))
      .returning();
    return updated;
  }

  async updateAppointmentStatus(id: number, status: string, paymentDetails?: { method?: string, status?: string, price?: number }): Promise<Appointment> {
    const updateData: any = { status };
    if (paymentDetails?.method) updateData.paymentMethod = paymentDetails.method;
    if (paymentDetails?.status) updateData.paymentStatus = paymentDetails.status;
    if (paymentDetails?.price) updateData.price = paymentDetails.price;

    const [updated] = await db.update(appointments).set(updateData).where(eq(appointments.id, id)).returning();
    return updated;
  }

  async deleteAppointment(id: number): Promise<void> {
    await db.delete(appointments).where(eq(appointments.id, id));
  }

  async getAvailabilityExceptions(clinicId: number, doctorId?: number, date?: string): Promise<AvailabilityException[]> {
    let conditions = [eq(availabilityExceptions.clinicId, clinicId)];
    if (doctorId) conditions.push(eq(availabilityExceptions.doctorId, doctorId));
    if (date) conditions.push(eq(availabilityExceptions.date, date));
    
    return await db.select().from(availabilityExceptions).where(and(...conditions));
  }

  async createAvailabilityException(exception: InsertAvailabilityException): Promise<AvailabilityException> {
    const [newEx] = await db.insert(availabilityExceptions).values(exception).returning();
    return newEx;
  }

  async deleteAvailabilityException(id: number): Promise<void> {
    await db.delete(availabilityExceptions).where(eq(availabilityExceptions.id, id));
  }

  async checkAvailability(clinicId: number, doctorId: number, date: string): Promise<boolean> {
    const exceptions = await this.getAvailabilityExceptions(clinicId, doctorId, date);
    const blocked = exceptions.some(ex => !ex.isAvailable);
    return !blocked;
  }

  async getMedicalRecords(patientId: number, clinicId: number): Promise<MedicalRecordWithDetails[]> {
    const records = await db.select().from(medicalRecords).where(and(eq(medicalRecords.patientId, patientId), eq(medicalRecords.clinicId, clinicId))).orderBy(desc(medicalRecords.createdAt));
    return await Promise.all(records.map(async (r) => {
      const [patient] = await db.select().from(patients).where(eq(patients.id, r.patientId));
      const [doctorData] = await db.select().from(users).where(eq(users.id, r.doctorId));
      const { password, ...doctor } = doctorData;
      return { ...r, patient, doctor } as MedicalRecordWithDetails;
    }));
  }

  async getMedicalRecord(id: number, clinicId: number): Promise<MedicalRecordWithDetails | undefined> {
    const [record] = await db.select().from(medicalRecords).where(and(eq(medicalRecords.id, id), eq(medicalRecords.clinicId, clinicId)));
    if (!record) return undefined;
    const [patient] = await db.select().from(patients).where(eq(patients.id, record.patientId));
    const [doctorData] = await db.select().from(users).where(eq(users.id, record.doctorId));
    const { password, ...doctor } = doctorData;
    return { ...record, patient, doctor } as MedicalRecordWithDetails;
  }

  async createMedicalRecord(record: InsertMedicalRecord): Promise<MedicalRecord> {
    const [newRecord] = await db.insert(medicalRecords).values(record).returning();
    await this.createMedicalRecordLog({
      medicalRecordId: newRecord.id,
      userId: record.doctorId,
      action: 'create',
      changes: record
    });
    return newRecord;
  }

  async updateMedicalRecord(id: number, record: Partial<InsertMedicalRecord>): Promise<MedicalRecord> {
    const [updated] = await db.update(medicalRecords).set(record as any).where(eq(medicalRecords.id, id)).returning();
    await this.createMedicalRecordLog({
      medicalRecordId: id,
      userId: updated.doctorId,
      action: 'update',
      changes: record
    });
    return updated;
  }

  async getInventory(clinicId: number): Promise<Inventory[]> {
    return await db.select().from(inventory).where(eq(inventory.clinicId, clinicId));
  }

  async createInventoryItem(item: InsertInventory): Promise<Inventory> {
    const [newItem] = await db.insert(inventory).values(item).returning();
    return newItem;
  }

  async updateInventoryItem(id: number, item: Partial<Inventory>): Promise<Inventory> {
    const [updated] = await db.update(inventory).set(item).where(eq(inventory.id, id)).returning();
    return updated;
  }

  async deleteInventoryItem(id: number): Promise<void> {
    await db.delete(inventory).where(eq(inventory.id, id));
  }

  async createInventoryTransaction(transaction: InsertInventoryTransaction): Promise<InventoryTransaction> {
    const [newTx] = await db.insert(inventoryTransactions).values(transaction).returning();
    const [item] = await db.select().from(inventory).where(eq(inventory.id, transaction.inventoryId));
    if (item) {
      const newQty = transaction.type === 'entrada' ? item.quantity + transaction.quantity : item.quantity - transaction.quantity;
      await db.update(inventory).set({ quantity: newQty }).where(eq(inventory.id, item.id));
    }
    return newTx;
  }

  async getTissBills(clinicId: number): Promise<TissBill[]> {
    return await db.select().from(tissBills).where(eq(tissBills.clinicId, clinicId));
  }

  async createTissBill(bill: InsertTissBill): Promise<TissBill> {
    const [newBill] = await db.insert(tissBills).values(bill).returning();
    return newBill;
  }

  async createDigitalSignature(signature: InsertDigitalSignature): Promise<DigitalSignature> {
    const [newSig] = await db.insert(digitalSignatures).values(signature).returning();
    return newSig;
  }

  async getSignaturesByRecord(recordId: number): Promise<DigitalSignature[]> {
    return await db.select().from(digitalSignatures).where(eq(digitalSignatures.medicalRecordId, recordId));
  }

  async updateTriage(appointmentId: number, triageData: any): Promise<Appointment> {
    const [updated] = await db.update(appointments)
      .set({ triageData: triageData as any, triageDone: true, status: 'presente' })
      .where(eq(appointments.id, appointmentId))
      .returning();
    return updated;
  }

  async createMedicalRecordLog(log: InsertMedicalRecordLog): Promise<MedicalRecordLog> {
    const [newLog] = await db.insert(medicalRecordLogs).values(log).returning();
    return newLog;
  }

  async getMedicalRecordLogs(medicalRecordId: number): Promise<MedicalRecordLog[]> {
    return await db.select().from(medicalRecordLogs)
      .where(eq(medicalRecordLogs.medicalRecordId, medicalRecordId))
      .orderBy(desc(medicalRecordLogs.createdAt));
  }

  async getClinics(): Promise<Clinic[]> {
    return await db.select().from(clinics).orderBy(desc(clinics.createdAt));
  }

  async getClinic(id: number): Promise<Clinic | undefined> {
    const [clinic] = await db.select().from(clinics).where(eq(clinics.id, id));
    return clinic;
  }

  async createClinic(clinic: InsertClinic): Promise<Clinic> {
    const [newClinic] = await db.insert(clinics).values(clinic).returning();
    return newClinic;
  }

  async updateClinic(id: number, clinic: Partial<InsertClinic>): Promise<Clinic> {
    const [updated] = await db.update(clinics).set(clinic).where(eq(clinics.id, id)).returning();
    return updated;
  }

  async deleteClinic(id: number): Promise<void> {
    await db.delete(clinics).where(eq(clinics.id, id));
  }
}

export const storage = new DatabaseStorage();