import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import fs from "fs";
import path from "path";
import os from "os";

async function makeApp() {
  // Create an isolated DB copy for tests
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "medflow-test-"));
  const srcDb = path.resolve(process.cwd(), "sqlite.db");
  const testDb = path.join(tmpDir, "sqlite.db");
  fs.copyFileSync(srcDb, testDb);

  process.env.NODE_ENV = "test";
  process.env.SESSION_SECRET = "test-secret";
  process.env.DB_PATH = testDb;
  // Ensure we don't use sqlite session store during tests
  process.env.SESSION_STORE = "memory";

  const expressMod = await import("express");
  const { createServer } = await import("http");
  const { registerRoutes } = await import("../routes");
  const { storage } = await import("../storage");

  const app = expressMod.default();
  app.use(expressMod.default.json());
  app.use(expressMod.default.urlencoded({ extended: false }));

  const httpServer = createServer(app);
  await registerRoutes(httpServer, app);

  // Seed users with known passwords
  const admin = await storage.createUser({
    username: "test.admin",
    password: "testpass",
    name: "Test Admin",
    role: "admin",
    clinicId: 1,
    isActive: true,
  } as any);

  const doctor = await storage.createUser({
    username: "test.doctor",
    password: "testpass",
    name: "Test Doctor",
    role: "doctor",
    specialty: "Clínico Geral",
    professionalCouncilType: "CRM",
    professionalCouncilNumber: "12345",
    professionalCouncilState: "SP",
    clinicId: 1,
    isActive: true,
  } as any);

  return { app, admin, doctor };
}

let ctx: Awaited<ReturnType<typeof makeApp>>;

beforeAll(async () => {
  ctx = await makeApp();
});

describe("Auth", () => {
  it("GET /api/user without session returns 401", async () => {
    const res = await request(ctx.app).get("/api/user");
    expect(res.status).toBe(401);
  });

  it("POST /api/login with valid credentials sets a session", async () => {
    const agent = request.agent(ctx.app);

    const login = await agent
      .post("/api/login")
      .send({ username: "test.admin", password: "testpass" });

    expect(login.status).toBe(200);
    expect(login.body).toHaveProperty("username", "test.admin");

    const me = await agent.get("/api/user");
    expect(me.status).toBe(200);
    expect(me.body).toHaveProperty("username", "test.admin");
  });
});

describe("Patients filters (SQL pushdown)", () => {
  it("missingPhone filter is applied and appointment flags work", async () => {
    const agent = request.agent(ctx.app);
    await agent.post("/api/login").send({ username: "test.admin", password: "testpass" });

    // Create a patient with missing phone
    const createPatient = await agent.post("/api/patients").send({
      name: "Paciente Sem Telefone",
      cpf: "123.456.789-00",
      birthDate: "2000-01-01",
      phone: "",
      email: "p@example.com",
      gender: "M",
      address: "Rua A, 123",
    });
    expect(createPatient.status).toBe(200);
    const patientId = createPatient.body.id;

    // Create an appointment today so hasAppointmentToday becomes true
    const today = new Date().toISOString().slice(0, 10);
    const createApt = await agent.post("/api/appointments").send({
      patientId,
      doctorId: ctx.doctor.id,
      date: today,
      startTime: "10:00",
      duration: 30,
      price: 15000,
      type: "consulta",
      status: "agendado",
      paymentStatus: "pendente",
      isPrivate: false,
    });
    expect(createApt.status).toBe(200);

    // Query patients with missingPhone=true and hasAppointmentToday=true
    const list = await agent.get("/api/patients?missingPhone=true&hasAppointmentToday=true&page=1&pageSize=20");
    expect(list.status).toBe(200);
    expect(list.body).toHaveProperty("items");

    const found = list.body.items.find((p: any) => p.id === patientId);
    expect(found).toBeTruthy();
    expect(found.hasAppointmentToday).toBe(true);
    expect(found.nextAppointmentAt).toContain(today);
  });
});
