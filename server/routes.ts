import type { Express } from "express";
import type { Server } from "http";
import { setupAuth, sanitizeUser } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { clinics, users, patients, appointments, medicalRecords, digitalSignatures, medicalRecordLogs, availabilityExceptions } from "@shared/schema";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { activateLicenseKey, getLicenseStatus, isLicenseValidOrThrow } from "./license";

// Single-tenant installation: one clinic per server.
// Keep DB schema clinic_id for backward compatibility, but the app always operates on clinicId = 1.
const SINGLE_CLINIC_ID = 1;

const UPLOAD_DIR = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(process.cwd(), "uploads");

// Configure multer for logo uploads
const storage_multer = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = new Set([".jpg", ".jpeg", ".png", ".webp"]);
    const safeExt = allowedExts.has(ext) ? ext : ".png";
    // Use a stable filename (so replacing logo keeps the same URL) with clinicId=1.
    cb(null, `clinic-${SINGLE_CLINIC_ID}-logo${safeExt}`);
  }
});

const upload = multer({
  storage: storage_multer,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = new Set([".jpg", ".jpeg", ".png", ".webp"]);
    const isImageMime = typeof file.mimetype === "string" && file.mimetype.startsWith("image/");
    const isAllowedExt = allowedExts.has(ext);

    if (isImageMime && isAllowedExt) return cb(null, true);
    cb(new Error("Apenas imagens (jpg, jpeg, png, webp) são permitidas"));
  }
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth (Passport)
  setupAuth(app);

  // Middleware to enforce auth
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Não autenticado" });
    }
    if (!isLicenseExemptPath(req.path)) {
      try {
        isLicenseValidOrThrow();
      } catch (e: any) {
        return res.status(402).json({ message: e?.message || "Licença inválida ou expirada" });
      }
    }
    return next();
  };

  const isLicenseExemptPath = (p: string) => {
    // Auth endpoints must work so admin can log in and activate license
    if (p === api.auth.login.path) return true;
    if (p === api.auth.logout.path) return true;
    if (p === api.auth.me.path) return true;
    // License endpoints themselves
    if (p.startsWith("/api/license")) return true;
    // Allow clinic header/sidebar to render so admin can reach the license page
    if (p === "/api/clinic/me") return true;
    // Health checks
    if (p === "/api/health") return true;
    return false;
  };

  const requireValidLicense = (req: any, res: any, next: any) => {
    try {
      if (isLicenseExemptPath(req.path)) return next();
      isLicenseValidOrThrow();
      return next();
    } catch (e: any) {
      return res.status(402).json({ message: e?.message || "Licença inválida ou expirada" });
    }
  };

  const requireRole = (roles: string[]) => {
    return (req: any, res: any, next: any) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      // Enforce license for all protected APIs by default
      if (!isLicenseExemptPath(req.path)) {
        try {
          isLicenseValidOrThrow();
        } catch (e: any) {
          return res.status(402).json({ message: e?.message || "Licença inválida ou expirada" });
        }
      }
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ message: "Sem permissão" });
      }
      next();
    };
  };

  const requireNotNurse = (req: any, res: any, next: any) => {
    if (req.user.role === "nurse") {
      return res.status(403).json({ message: "Sem permissão para esta ação" });
    }
    next();
  };

  // License endpoints (Admin)
  // Status can be viewed by admin and reception/operator so they can see expiry warnings.
  app.get(api.license.status.path, requireRole(["admin", "super_admin", "operator"]), async (_req, res) => {
    const status = getLicenseStatus();
    res.json(status);
  });

  app.post(api.license.activate.path, requireRole(["admin", "super_admin"]), async (req, res) => {
    try {
      const input = api.license.activate.input.parse(req.body);
      const result = activateLicenseKey(input.key);
      res.json(result);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(400).json({ message: err?.message || "Não foi possível ativar a licença" });
    }
  });

  // Users
  app.get(api.users.list.path, requireRole(["admin", "super_admin"]), async (req, res) => {
    const role = req.query.role as string | undefined;
    const includeInactive = req.query.includeInactive === "true";

    // Single-tenant: always scope to clinicId=1
    const users = await storage.getUsersByClinic(SINGLE_CLINIC_ID, role, includeInactive);
    res.json(users.map(sanitizeUser));
  });

  app.get(api.users.get.path, requireRole(["admin", "super_admin"]), async (req, res) => {
    const user = await storage.getUser(Number(req.params.id));
    if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
    res.json(sanitizeUser(user));
  });

  app.post(api.users.create.path, requireRole(["admin"]), async (req, res) => {
    try {
      const input = api.users.create.input.parse(req.body);
      
      if (!input.username) {
        return res.status(400).json({ message: "Usuário é obrigatório" });
      }

      const existingUser = await storage.getUserByUsername(input.username.toLowerCase());
      if (existingUser) {
        return res.status(409).json({ message: "Usuário já existe" });
      }

      // Validation for professional council info
      if (input.role === "doctor" || input.role === "nurse") {
        if (!input.professionalCouncilType || !input.professionalCouncilNumber || !input.professionalCouncilState) {
          return res.status(400).json({ message: "Informações de conselho profissional (tipo, número e estado) são obrigatórias para médicos e enfermeiros." });
        }
      } else if (input.role === "operator" || input.role === "admin") {
        if (input.professionalCouncilType || input.professionalCouncilNumber || input.professionalCouncilState) {
          return res.status(400).json({ message: "Informações de conselho profissional não são permitidas para administradores ou operadores." });
        }
      }

      // @ts-ignore
      const user = await storage.createUser({
        ...input,
        username: input.username.toLowerCase(),
        clinicId: SINGLE_CLINIC_ID,
      });
      res.status(201).json(sanitizeUser(user));
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.users.update.path, requireRole(["admin"]), async (req, res) => {
    try {
      const user = await storage.getUser(Number(req.params.id));
      if (!user || user.clinicId !== SINGLE_CLINIC_ID) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      const { username, ...updateData } = req.body;

      // Validation for professional council info on update
      const targetRole = updateData.role || user.role;
      if (targetRole === "doctor" || targetRole === "nurse") {
        // If it's a doctor/nurse, ensure council info is present (either in update or existing)
        const councilType = updateData.professionalCouncilType !== undefined ? updateData.professionalCouncilType : user.professionalCouncilType;
        const councilNumber = updateData.professionalCouncilNumber !== undefined ? updateData.professionalCouncilNumber : user.professionalCouncilNumber;
        const councilState = updateData.professionalCouncilState !== undefined ? updateData.professionalCouncilState : user.professionalCouncilState;

        if (!councilType || !councilNumber || !councilState) {
          return res.status(400).json({ message: "Informações de conselho profissional são obrigatórias para médicos e enfermeiros." });
        }
      } else if (targetRole === "operator" || targetRole === "admin") {
        if (updateData.professionalCouncilType || updateData.professionalCouncilNumber || updateData.professionalCouncilState) {
          return res.status(400).json({ message: "Informações de conselho profissional não são permitidas para administradores ou operadores." });
        }
      }

      const updated = await storage.updateUser(Number(req.params.id), updateData);
      res.json(sanitizeUser(updated));
    } catch (err) {
      res.status(500).json({ message: "Erro ao atualizar usuário" });
    }
  });

  app.delete(api.users.delete.path, requireRole(["admin"]), async (req, res) => {
    try {
      // @ts-ignore
      const clinicId = SINGLE_CLINIC_ID;
      const targetUserId = Number(req.params.id);
      
      const user = await storage.getUser(targetUserId);
      if (!user || user.clinicId !== clinicId) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // 1. Não permitir excluir a si mesmo
      if (targetUserId === (req.user as any).id) {
        return res.status(400).json({ message: "Você não pode excluir seu próprio usuário" });
      }

      // 2. Não permitir excluir o último administrador
      if (user.role === "admin") {
        const admins = await storage.getUsersByClinic(clinicId, "admin");
        const activeAdmins = admins.filter(a => a.isActive);
        if (activeAdmins.length <= 1) {
          return res.status(409).json({ message: "Não é possível excluir o último administrador" });
        }
      }

      await storage.deleteUser(targetUserId);
      res.sendStatus(204);
    } catch (err) {
      console.error("Erro ao excluir usuário:", err);
      res.status(500).json({ message: "Erro ao excluir usuário" });
    }
  });

  app.delete("/api/users/:id/hard", requireRole(["admin"]), async (req, res) => {
    try {
      // @ts-ignore
      const clinicId = SINGLE_CLINIC_ID;
      const targetUserId = Number(req.params.id);
      
      const user = await storage.getUser(targetUserId);
      if (!user || user.clinicId !== clinicId) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      // 1. Não permitir excluir a si mesmo
      if (targetUserId === (req.user as any).id) {
        return res.status(400).json({ message: "Você não pode excluir seu próprio usuário" });
      }

      // 2. Não permitir excluir o último administrador
      if (user.role === "admin") {
        const admins = await storage.getUsersByClinic(clinicId, "admin");
        const activeAdmins = admins.filter(a => a.isActive);
        if (activeAdmins.length <= 1) {
          return res.status(409).json({ message: "Não é possível excluir o último administrador" });
        }
      }

      // 3. Verificar vínculos (já feito no storage, mas mantemos o erro amigável aqui)
      await storage.hardDeleteUser(targetUserId, clinicId);
      res.sendStatus(204);
    } catch (err: any) {
      console.error("Erro ao excluir permanentemente usuário:", err);
      res.status(err.message.includes("registros vinculados") ? 409 : 500).json({ 
        message: err.message || "Erro ao excluir permanentemente usuário" 
      });
    }
  });

  app.get("/api/doctors", requireRole(["admin", "operator"]), async (req, res) => {
    // @ts-ignore
    const clinicId = SINGLE_CLINIC_ID;
    const doctors = await storage.getDoctorsByClinic(clinicId);
    res.json(doctors);
  });

  // Patients
  // REGRAS: Enfermagem NÃO pode acessar a página/listagem de pacientes.
  // Apenas Admin (inclui super_admin) e Recepção (operator).
  app.get(api.patients.list.path, requireRole(["admin", "super_admin", "operator"]), async (req, res) => {
    // @ts-ignore
    const clinicId = SINGLE_CLINIC_ID;
    const params = {
      search: req.query.search as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
      sortBy: (req.query.sortBy as any) || undefined,
      sortDir: (req.query.sortDir as any) || undefined,
      gender: req.query.gender as string | undefined,
      ageMin: req.query.ageMin !== undefined ? Number(req.query.ageMin) : undefined,
      ageMax: req.query.ageMax !== undefined ? Number(req.query.ageMax) : undefined,
      hasAppointmentToday: req.query.hasAppointmentToday !== undefined ? req.query.hasAppointmentToday === "true" : undefined,
      missingPhone: req.query.missingPhone !== undefined ? req.query.missingPhone === "true" : undefined,
      missingEmail: req.query.missingEmail !== undefined ? req.query.missingEmail === "true" : undefined,
      includeArchived: req.query.includeArchived !== undefined ? req.query.includeArchived === "true" : undefined,
      onlyArchived: req.query.onlyArchived !== undefined ? req.query.onlyArchived === "true" : undefined,
    };
    const result = await storage.getPatients(clinicId, params);
    res.json(result);
  });

  app.get(api.patients.get.path, requireRole(["admin", "super_admin", "operator"]), async (req, res) => {
    // @ts-ignore
    const clinicId = SINGLE_CLINIC_ID;
    const patient = await storage.getPatient(Number(req.params.id), clinicId);
    if (!patient) return res.status(404).json({ message: "Paciente não encontrado" });
    res.json(patient);
  });

  app.post(api.patients.create.path, requireRole(["admin", "operator"]), requireNotNurse, async (req, res) => {
    try {
      const input = api.patients.create.input.parse(req.body);
      const patient = await storage.createPatient({
        ...input,
        // @ts-ignore
        clinicId: SINGLE_CLINIC_ID,
      });
      res.status(201).json(patient);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.patients.update.path, requireRole(["admin", "operator"]), requireNotNurse, async (req, res) => {
    try {
      // @ts-ignore
      const clinicId = SINGLE_CLINIC_ID;
      const patient = await storage.getPatient(Number(req.params.id), clinicId);
      if (!patient) return res.status(404).json({ message: "Paciente não encontrado" });

      const input = api.patients.update.input.parse(req.body);
      const updated = await storage.updatePatient(Number(req.params.id), input);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Erro ao atualizar paciente" });
    }
  });

  // Archive (soft delete)
  app.patch(api.patients.archive.path, requireRole(["admin", "operator"]), requireNotNurse, async (req, res) => {
    try {
      // @ts-ignore
      const clinicId = SINGLE_CLINIC_ID;
      const patient = await storage.getPatient(Number(req.params.id), clinicId);
      if (!patient) return res.status(404).json({ message: "Paciente não encontrado" });

      const input = api.patients.archive.input.parse(req.body);
      const updated = await storage.archivePatient(Number(req.params.id), clinicId, input.archived);
      res.json(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Erro ao arquivar paciente" });
    }
  });

  // Permanent delete (only if no links)
  app.delete(api.patients.hardDelete.path, requireRole(["admin"]), requireNotNurse, async (req, res) => {
    try {
      // @ts-ignore
      const clinicId = SINGLE_CLINIC_ID;
      const patient = await storage.getPatient(Number(req.params.id), clinicId);
      if (!patient) return res.status(404).json({ message: "Paciente não encontrado" });

      await storage.hardDeletePatient(Number(req.params.id), clinicId);
      res.sendStatus(204);
    } catch (err: any) {
      const msg = err?.message || "Erro ao excluir paciente";
      res.status(msg.includes("vinculados") ? 409 : 500).json({ message: msg });
    }
  });

  // Export CSV of filtered patients
  app.get(api.patients.export.path, requireRole(["admin", "super_admin", "operator"]), requireNotNurse, async (req, res) => {
    // @ts-ignore
    const clinicId = SINGLE_CLINIC_ID;
    const csv = await storage.exportPatientsCsv(clinicId, {
      search: req.query.search as string | undefined,
      gender: req.query.gender as string | undefined,
      ageMin: req.query.ageMin !== undefined ? Number(req.query.ageMin) : undefined,
      ageMax: req.query.ageMax !== undefined ? Number(req.query.ageMax) : undefined,
      hasAppointmentToday: req.query.hasAppointmentToday !== undefined ? req.query.hasAppointmentToday === "true" : undefined,
      missingPhone: req.query.missingPhone !== undefined ? req.query.missingPhone === "true" : undefined,
      missingEmail: req.query.missingEmail !== undefined ? req.query.missingEmail === "true" : undefined,
      includeArchived: req.query.includeArchived !== undefined ? req.query.includeArchived === "true" : undefined,
      onlyArchived: req.query.onlyArchived !== undefined ? req.query.onlyArchived === "true" : undefined,
    });
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="patients-export.csv"`);
    res.send(csv);
  });

  // Appointments
  app.get(api.appointments.list.path, requireAuth, async (req, res) => {
    // @ts-ignore
    const user = req.user!;
    const clinicId = SINGLE_CLINIC_ID;
    
    const filters: any = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      date: req.query.date as string,
      doctorId: req.query.doctorId ? Number(req.query.doctorId) : undefined,
      patientId: req.query.patientId ? Number(req.query.patientId) : undefined,
      status: req.query.status as string,
    };

    // Restrict doctors to only their own appointments
    if (user.role === "doctor") {
      filters.doctorId = user.id;
    }

    const appointments = await storage.getAppointments(clinicId, filters);

    if (user.role === "nurse") {
      const sanitized = appointments.map(apt => ({
        id: apt.id,
        date: apt.date,
        startTime: apt.startTime,
        duration: apt.duration,
        status: apt.status,
        type: apt.type,
        // Nurse dashboard precisa saber se a triagem já foi finalizada
        triageDone: (apt as any).triageDone,
        // Exibir observações do agendamento quando existirem
        notes: (apt as any).notes,
        doctor: { id: apt.doctor.id, name: apt.doctor.name },
        // Nurse dashboard usa CPF e data de nascimento para exibir idade/identificação
        patient: {
          id: apt.patient.id,
          name: apt.patient.name,
          cpf: (apt.patient as any).cpf,
          birthDate: (apt.patient as any).birthDate,
        }
      }));
      return res.json(sanitized);
    }

    res.json(appointments);
  });

  app.get("/api/appointments/:id", requireAuth, async (req, res) => {
    // @ts-ignore
    const user = req.user!;
    const clinicId = SINGLE_CLINIC_ID;
    const apt = await storage.getAppointment(Number(req.params.id), clinicId);

    if (!apt) return res.status(404).json({ message: "Agendamento não encontrado" });

    // Restrict doctors to only their own appointments
    if (user.role === "doctor" && apt.doctorId !== user.id) {
      return res.status(403).json({ message: "Sem permissão" });
    }

    // Enrich with patient and doctor details
    const patientsList = await storage.getPatients(clinicId, { page: 1, pageSize: 100000, includeArchived: true });
    const patient = patientsList.items.find(p => p.id === apt.patientId);
    const doctor = await storage.getUser(apt.doctorId);

    res.json({ ...apt, patient, doctor });
  });

  app.post(api.appointments.create.path, requireRole(["admin", "operator"]), requireNotNurse, async (req, res) => {
    try {
      const input = api.appointments.create.input.parse(req.body);
      // @ts-ignore
      const clinicId = SINGLE_CLINIC_ID;

      // Check doctor availability for the date
      const doctor = await storage.getUser(input.doctorId);
      if (!doctor || doctor.clinicId !== clinicId || !doctor.isActive) {
        return res.status(409).json({ message: "Médico inativo ou não encontrado." });
      }

      const isAvailable = await storage.checkAvailability(clinicId, input.doctorId, input.date);
      if (!isAvailable) {
        return res.status(400).json({ message: "A agenda deste médico está fechada para esta data." });
      }

      const duration = input.duration || 30;
      const startTime = input.startTime;
      const [startHour, startMin] = startTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = startMinutes + duration;

      // Check for overlapping appointments
      const existing = await storage.getAppointments(clinicId, {
        date: input.date,
        doctorId: input.doctorId
      });

      const hasConflict = existing.some(apt => {
        const [aptHour, aptMin] = apt.startTime.split(':').map(Number);
        const aptStartMinutes = aptHour * 60 + aptMin;
        const aptEndMinutes = aptStartMinutes + apt.duration;

        return (startMinutes < aptEndMinutes && endMinutes > aptStartMinutes);
      });

      if (hasConflict) {
        return res.status(400).json({ message: "Este horário já está ocupado para este médico." });
      }

      const appointment = await storage.createAppointment({
        ...input,
        clinicId,
      });
      res.status(201).json(appointment);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.put(api.appointments.update.path, requireRole(["admin", "operator"]), requireNotNurse, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const input = req.body;
      // @ts-ignore
      const clinicId = SINGLE_CLINIC_ID;

      const currentApt = await storage.getAppointment(id, clinicId);
      if (!currentApt) return res.status(404).json({ message: "Agendamento não encontrado" });
      
      // ... logic continues

      if (input.startTime || input.date || input.doctorId) {
        const appointmentDate = input.date || currentApt.date;
        const doctorId = input.doctorId || currentApt.doctorId;
        
        if (appointmentDate && doctorId) {
          const existing = await storage.getAppointments(clinicId, {
            date: appointmentDate,
            doctorId: doctorId
          });

          const startTime = input.startTime || currentApt.startTime;
          const duration = input.duration || currentApt.duration || 30;

          if (startTime) {
            const [startHour, startMin] = startTime.split(':').map(Number);
            const startMinutes = startHour * 60 + startMin;
            const endMinutes = startMinutes + duration;

            const hasConflict = existing.some(apt => {
              if (apt.id === id) return false;
              const [aptHour, aptMin] = apt.startTime.split(':').map(Number);
              const aptStartMinutes = aptHour * 60 + aptMin;
              const aptEndMinutes = aptStartMinutes + apt.duration;

              return (startMinutes < aptEndMinutes && endMinutes > aptStartMinutes);
            });

            if (hasConflict) {
              return res.status(400).json({ message: "Este horário já está ocupado para este médico." });
            }
          }
        }
      }

      const updated = await storage.updateAppointment(id, clinicId, input);
      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Erro ao atualizar agendamento" });
    }
  });

  app.delete("/api/appointments/:id", requireRole(["admin", "operator"]), requireNotNurse, async (req, res) => {
    try {
      // @ts-ignore
      const clinicId = SINGLE_CLINIC_ID;
      const apt = await storage.getAppointment(Number(req.params.id), clinicId);
      if (!apt) return res.status(404).json({ message: "Agendamento não encontrado" });

      await storage.deleteAppointment(Number(req.params.id));
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Erro ao excluir agendamento" });
    }
  });

  // Update status / triage
  // - Enfermagem (nurse): pode SOMENTE enviar triageData (finalizar triagem)
  // - Demais perfis: mantém regras atuais
  app.patch(api.appointments.updateStatus.path, requireRole(["admin", "super_admin", "operator", "doctor", "nurse"]), async (req, res) => {
    const { status, paymentMethod, paymentStatus, price, triageData } = req.body;
    // @ts-ignore
    const user = req.user!;
    const clinicId = SINGLE_CLINIC_ID;
    const apt = await storage.getAppointment(Number(req.params.id), clinicId);
    
    if (!apt) return res.status(404).json({ message: "Agendamento não encontrado" });

    // Restrict doctors to only their own appointments
    if (user.role === "doctor" && apt.doctorId !== user.id) {
      return res.status(404).json({ message: "Agendamento não encontrado" });
    }
    
    // Nurse can ONLY submit triageData
    if (user.role === "nurse") {
      if (!triageData) {
        return res.status(403).json({ message: "Sem permissão" });
      }
      if (apt.triageDone) {
        return res.status(403).json({ message: "Triagem já foi finalizada para este agendamento." });
      }
      const updated = await storage.updateTriage(Number(req.params.id), triageData);
      return res.json(updated);
    }

    // Non-nurse: triage update is allowed
    if (triageData) {
      const updated = await storage.updateTriage(Number(req.params.id), triageData);
      return res.json(updated);
    }

    // Se já estiver finalizado, impedir apenas a reabertura (trocar o status para algo diferente de "finalizado").
    // Pagamento (e outros campos) ainda podem ser atualizados mantendo o status "finalizado".
    if (apt.status === "finalizado" && status && status !== "finalizado") {
      return res.status(403).json({ message: "Este atendimento já foi finalizado e não pode ser aberto novamente." });
    }

    const nextStatus = status ?? apt.status;

    const updated = await storage.updateAppointmentStatus(
      Number(req.params.id),
      nextStatus,
      { method: paymentMethod, status: paymentStatus, price: price ? Math.round(price * 100) : undefined }
    );
    res.json(updated);
  });

  // Availability Exceptions
  app.get("/api/availability-exceptions", requireAuth, async (req, res) => {
    try {
      // @ts-ignore
      const user = req.user!;
      const clinicId = SINGLE_CLINIC_ID;
      let doctorId = req.query.doctorId ? Number(req.query.doctorId) : undefined;
      
      // Restrict doctors to only their own exceptions
      if (user.role === "doctor") {
        doctorId = user.id;
      }
      
      const date = req.query.date as string | undefined;
      const exceptions = await storage.getAvailabilityExceptions(clinicId, doctorId, date);
      res.json(exceptions);
    } catch (err) {
      res.status(500).json({ message: "Erro ao buscar disponibilidade" });
    }
  });

  app.post("/api/availability-exceptions", requireAuth, requireNotNurse, async (req, res) => {
    try {
      // @ts-ignore
      const clinicId = SINGLE_CLINIC_ID;
      const { doctorId, date, dates, isAvailable } = req.body;

      if (dates && Array.isArray(dates)) {
        // Bulk creation
        const results = [];
        for (const d of dates) {
          const exception = await storage.createAvailabilityException({
            doctorId,
            date: d,
            isAvailable,
            clinicId,
          });
          results.push(exception);
        }
        return res.status(201).json(results);
      }

      const exception = await storage.createAvailabilityException({
        ...req.body,
        clinicId,
      });
      res.status(201).json(exception);
    } catch (err) {
      res.status(500).json({ message: "Erro ao criar exceção de disponibilidade" });
    }
  });

  app.post("/api/availability-exceptions/bulk-delete", requireAuth, requireNotNurse, async (req, res) => {
    try {
      // @ts-ignore
      const clinicId = SINGLE_CLINIC_ID;
      const { doctorId, dates } = req.body;

      if (!dates || !Array.isArray(dates)) {
        return res.status(400).json({ message: "Datas inválidas" });
      }

      for (const d of dates) {
        const exceptions = await storage.getAvailabilityExceptions(clinicId, doctorId, d);
        for (const ex of exceptions) {
          await storage.deleteAvailabilityException(ex.id);
        }
      }
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Erro ao excluir exceções de disponibilidade" });
    }
  });

  app.delete("/api/availability-exceptions/:id", requireAuth, requireNotNurse, async (req, res) => {
    try {
      await storage.deleteAvailabilityException(Number(req.params.id));
      res.sendStatus(204);
    } catch (err) {
      res.status(500).json({ message: "Erro ao excluir exceção de disponibilidade" });
    }
  });

  // Medical Records
  app.get(api.medicalRecords.listByPatient.path, requireRole(["admin", "operator", "doctor"]), requireNotNurse, async (req, res) => {
    // @ts-ignore
    const user = req.user!;
    const clinicId = SINGLE_CLINIC_ID;
    let records = await storage.getMedicalRecords(Number(req.params.patientId), clinicId);

    // Restrict doctors to only see records they created
    if (user.role === "doctor") {
      records = records.filter(r => r.doctorId === user.id);
    }

    res.json(records);
  });

  app.get(api.medicalRecords.get.path, requireRole(["admin", "operator", "doctor"]), requireNotNurse, async (req, res) => {
    // @ts-ignore
    const user = req.user!;
    const clinicId = SINGLE_CLINIC_ID;
    const record = await storage.getMedicalRecord(Number(req.params.id), clinicId);
    if (!record) return res.status(404).json({ message: "Registro não encontrado" });

    // Restrict doctors to only their own records
    if (user.role === "doctor" && record.doctorId !== user.id) {
      return res.status(404).json({ message: "Registro não encontrado" });
    }

    res.json(record);
  });

  app.post(api.medicalRecords.create.path, requireRole(["admin", "doctor"]), requireNotNurse, async (req, res) => {
    try {
      const input = api.medicalRecords.create.input.parse(req.body);
      // @ts-ignore
      const user = req.user!;
      const clinicId = SINGLE_CLINIC_ID;

      // 1. Validar se o agendamento existe e se já foi finalizado
      if (input.appointmentId) {
        const apt = await storage.getAppointment(input.appointmentId, clinicId);
        if (!apt) {
          return res.status(404).json({ message: "Consulta não encontrada" });
        }
        
        // Ensure doctor can only create records for their own appointments
        if (user.role === "doctor" && apt.doctorId !== user.id) {
          return res.status(403).json({ message: "Sem permissão para este atendimento" });
        }

        if (apt.status === "finalizado") {
          return res.status(403).json({
            message: "Este atendimento já foi finalizado."
          });
        }
      }

      // 2. Criar o prontuário médico
      const record = await storage.createMedicalRecord({
        ...input,
        clinicId,
      });

      // 3. Atualizar status do agendamento se fornecido e válido (já validado acima)
      if (input.appointmentId) {
        await storage.updateAppointmentStatus(
          input.appointmentId,
          "finalizado",
          {}
        );
      }

      // 4. Retorno único e final
      return res.status(201).json(record);

    } catch (err) {
      console.error("Erro ao finalizar atendimento:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      return res.status(500).json({
        message: "Erro interno ao finalizar atendimento"
      });
    }
  });

  app.put(api.medicalRecords.update.path, requireRole(["admin", "doctor"]), requireNotNurse, async (req, res) => {
    // @ts-ignore
    const user = req.user!;
    const clinicId = SINGLE_CLINIC_ID;
    const record = await storage.getMedicalRecord(Number(req.params.id), clinicId);
    if (!record) return res.status(404).json({ message: "Registro não encontrado" });

    // Restrict doctors to only their own records
    if (user.role === "doctor" && record.doctorId !== user.id) {
      return res.status(404).json({ message: "Registro não encontrado" });
    }

    const updated = await storage.updateMedicalRecord(Number(req.params.id), req.body);
    res.json(updated);
  });

  // Inventory
  app.get("/api/inventory", requireRole(["admin", "operator"]), async (req, res) => {
    const clinicId = SINGLE_CLINIC_ID;
    const items = await storage.getInventory(clinicId);
    res.json(items);
  });

  app.post("/api/inventory", requireRole(["admin", "operator"]), async (req, res) => {
    const clinicId = SINGLE_CLINIC_ID;
    const item = await storage.createInventoryItem({ ...req.body, clinicId });
    res.status(201).json(item);
  });

  app.delete("/api/inventory/:id", requireRole(["admin"]), async (req, res) => {
    await storage.deleteInventoryItem(Number(req.params.id));
    res.sendStatus(204);
  });

  app.post("/api/inventory/transaction", requireRole(["admin", "operator"]), async (req, res) => {
    const tx = await storage.createInventoryTransaction(req.body);
    res.status(201).json(tx);
  });

  // TISS
  app.get("/api/tiss", requireAuth, async (req, res) => {
    const clinicId = SINGLE_CLINIC_ID;
    const bills = await storage.getTissBills(clinicId);
    res.json(bills);
  });

  app.post("/api/tiss", requireAuth, async (req, res) => {
    const clinicId = SINGLE_CLINIC_ID;
    const bill = await storage.createTissBill({ ...req.body, clinicId });
    res.status(201).json(bill);
  });

  // Digital Signature
  app.post("/api/medical-records/:id/sign", requireAuth, async (req, res) => {
    const doctorId = (req.user as any).id;
    const recordId = Number(req.params.id);
    const signature = await storage.createDigitalSignature({
      medicalRecordId: recordId,
      doctorId,
      signatureHash: req.body.hash,
      certificateInfo: req.body.certificate,
    });
    res.status(201).json(signature);
  });

  // Clinics
  app.get("/api/clinic/me", requireAuth, async (req, res) => {
    // @ts-ignore
    const clinicId = SINGLE_CLINIC_ID;
    const clinic = await storage.getClinic(clinicId);
    if (!clinic) return res.status(404).json({ message: "Clínica não encontrada" });
    
    // Remove sensitive or unnecessary fields
    const { subscriptionStatus, createdAt, ...safeClinic } = clinic;
    res.json(safeClinic);
  });

  app.put("/api/clinic/me", requireRole(["admin"]), async (req, res) => {
    try {
      // @ts-ignore
      const clinicId = SINGLE_CLINIC_ID;
      
      const updateSchema = z.object({
        name: z.string().min(1, "Nome é obrigatório"),
        cnpj: z.string().transform(val => val.replace(/\D/g, "")).pipe(z.string().length(14, "CNPJ deve ter 14 dígitos")),
        address: z.string().optional().nullable(),
        phone: z.string().optional().nullable(),
        logoUrl: z.string().url().optional().nullable(),
      });

      const input = updateSchema.parse(req.body);
      const updated = await storage.updateClinic(clinicId, input);
      
      const { subscriptionStatus, createdAt, ...safeClinic } = updated;
      res.json(safeClinic);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      res.status(500).json({ message: "Erro ao atualizar clínica" });
    }
  });

  app.post("/api/clinic/me/logo", requireRole(["admin"]), upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }

      // @ts-ignore
      const clinicId = SINGLE_CLINIC_ID;
      const logoUrl = `/uploads/${req.file.filename}`;

      const updated = await storage.updateClinic(clinicId, { logoUrl });
      
      const { subscriptionStatus, createdAt, ...safeClinic } = updated;
      res.json(safeClinic);
    } catch (err) {
      console.error("Erro no upload de logo:", err);
      res.status(500).json({ message: "Erro ao processar upload" });
    }
  });

  // Multi-clinic (SaaS) endpoints removed: single-tenant installation.

  // SEED DATA
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingUser = await storage.getUserByUsername("admin");
  if (!existingUser) {
    console.log("Semeando banco de dados...");

    // Single-tenant: ensure we always have a primary clinic with id=1
    const [existingClinic] = await db.select().from(clinics).where(eq(clinics.id, SINGLE_CLINIC_ID));
    const clinic = existingClinic
      ? existingClinic
      : (await db.insert(clinics).values({
          id: SINGLE_CLINIC_ID,
          name: "Clínica Saúde Total",
          address: "RUA OTAVIO DE BRITO, 20
            MED CENTER, SAO LUCAS
            38747-500 Patrocínio / Minas Gerais",
          phone: "(11) 5555-0123",
          subscriptionStatus: "active",
        }).returning())[0];

    // Create Users
    await storage.createUser({
      username: "admin",
      password: "password123", // In real app, hash this
      name: "Administrador do Sistema",
      role: "admin",
      clinicId: clinic.id
    });

    const doctor = await storage.createUser({
      username: "doctor",
      password: "password123",
      name: "Dr. Gregory House",
      role: "doctor",
      specialty: "Infectologista",
      clinicId: clinic.id
    });

    await storage.createUser({
      username: "operator",
      password: "password123",
      name: "Ana Oliveira",
      role: "operator",
      clinicId: clinic.id
    });

    await storage.createUser({
      username: "clara.santos",
      password: "password123",
      name: "Clara Santos",
      role: "nurse",
      clinicId: clinic.id
    });

    // Create Patients
    const patient1 = await storage.createPatient({
      name: "João Silva",
      birthDate: "1980-05-15",
      phone: "(11) 98888-7777",
      email: "joao@exemplo.com",
      gender: "Masculino",
      address: "Rua das Flores, 123",
      clinicId: clinic.id,
      cpf: "123.456.789-00"
    });

    const patient2 = await storage.createPatient({
      name: "Maria Oliveira",
      birthDate: "1992-08-20",
      phone: "(11) 97777-6666",
      email: "maria@exemplo.com",
      gender: "Feminino",
      address: "Av. Brasil, 456",
      clinicId: clinic.id,
      cpf: "987.654.321-99"
    });

    // Create Appointments
    await storage.createAppointment({
      patientId: patient1.id,
      doctorId: doctor.id,
      clinicId: clinic.id,
      date: new Date().toISOString().split('T')[0], // Today
      startTime: "09:00",
      duration: 30,
      status: "presente",
      notes: "Consulta de rotina - Hipertensão"
    });

    await storage.createAppointment({
      patientId: patient2.id,
      doctorId: doctor.id,
      clinicId: clinic.id,
      date: new Date().toISOString().split('T')[0], // Today
      startTime: "10:30",
      duration: 30,
      status: "presente",
      notes: "Avaliação pré-operatória"
    });

    // Seed Inventory
    await storage.createInventoryItem({
      clinicId: clinic.id,
      name: "Seringa 5ml",
      category: "material",
      unit: "unidade",
      quantity: 50,
      minQuantity: 10,
      pricePerUnit: 50,
    });

    await storage.createInventoryItem({
      clinicId: clinic.id,
      name: "Dipirona 500mg",
      category: "medicamento",
      unit: "caixa",
      quantity: 5,
      minQuantity: 8,
      pricePerUnit: 1200,
    });

    console.log("Semeio concluído!");
  }
}
