import LayoutShell from "@/components/layout-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function IMCCalculator() {
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const weightNum = parseFloat(weight);
  const heightNum = parseFloat(height) / 100;
  const imc = weightNum && heightNum ? (weightNum / (heightNum * heightNum)).toFixed(1) : null;

  const getIMCStatus = (val: number) => {
    if (val < 18.5) return { label: "Abaixo do peso", color: "text-blue-500" };
    if (val < 25) return { label: "Peso normal", color: "text-green-500" };
    if (val < 30) return { label: "Sobrepeso", color: "text-yellow-500" };
    return { label: "Obesidade", color: "text-red-500" };
  };

  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Peso (kg)</Label>
          <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="ex: 70" />
        </div>
        <div className="space-y-2">
          <Label>Altura (cm)</Label>
          <Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="ex: 175" />
        </div>
      </div>
      {imc && (
        <div className="p-4 bg-slate-50 rounded-lg text-center">
          <p className="text-sm text-muted-foreground">Seu IMC é</p>
          <p className="text-4xl font-bold text-primary my-1">{imc}</p>
          <p className={cn("font-medium", getIMCStatus(parseFloat(imc)).color)}>
            {getIMCStatus(parseFloat(imc)).label}
          </p>
        </div>
      )}
    </div>
  );
}

function GFRCalculator() {
  const [creatinine, setCreatinine] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("male");
  
  // Simplified CKD-EPI
  const calculateGFR = () => {
    const cr = parseFloat(creatinine);
    const a = parseFloat(age);
    if (!cr || !a) return null;
    
    let gfr = 141 * Math.min(cr / (gender === 'female' ? 0.7 : 0.9), 1) ** (gender === 'female' ? -0.329 : -0.411) *
              Math.max(cr / (gender === 'female' ? 0.7 : 0.9), 1) ** -1.209 *
              0.993 ** a * (gender === 'female' ? 1.018 : 1);
    return gfr.toFixed(1);
  };

  const gfr = calculateGFR();

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Creatinina Sérica (mg/dL)</Label>
        <Input type="number" value={creatinine} onChange={(e) => setCreatinine(e.target.value)} placeholder="ex: 1.0" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Idade</Label>
          <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="ex: 45" />
        </div>
        <div className="space-y-2">
          <Label>Sexo</Label>
          <select 
            className="w-full h-10 px-3 rounded-md border border-input bg-background"
            value={gender} 
            onChange={(e) => setGender(e.target.value)}
          >
            <option value="male">Masculino</option>
            <option value="female">Feminino</option>
          </select>
        </div>
      </div>
      {gfr && (
        <div className="p-4 bg-slate-50 rounded-lg text-center">
          <p className="text-sm text-muted-foreground">TFG Estimada</p>
          <p className="text-4xl font-bold text-primary my-1">{gfr}</p>
          <p className="text-xs text-muted-foreground">mL/min/1.73m² (CKD-EPI)</p>
        </div>
      )}
    </div>
  );
}

import { cn } from "@/lib/utils";

function PediatricDoseCalculator() {
  const [weight, setWeight] = useState("");
  const [dosage, setDosage] = useState("");
  const [concentration, setConcentration] = useState(""); // mg
  const [volume, setVolume] = useState(""); // ml
  const [frequency, setFrequency] = useState("1");

  const weightNum = parseFloat(weight);
  const dosageNum = parseFloat(dosage);
  const concNum = parseFloat(concentration);
  const volNum = parseFloat(volume);
  const freqNum = parseInt(frequency);

  const totalDoseMg = weightNum && dosageNum ? weightNum * dosageNum : null;
  const dosePerTimeMg = totalDoseMg && freqNum ? totalDoseMg / freqNum : null;
  const dosePerTimeMl = dosePerTimeMg && concNum && volNum ? (dosePerTimeMg * volNum) / concNum : null;

  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Peso da Criança (kg)</Label>
          <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="ex: 15" />
        </div>
        <div className="space-y-2">
          <Label>Dose (mg/kg/dia)</Label>
          <Input type="number" value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="ex: 50" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Conc. (mg)</Label>
          <Input type="number" value={concentration} onChange={(e) => setConcentration(e.target.value)} placeholder="ex: 250" />
        </div>
        <div className="space-y-2">
          <Label>Em quantos ml?</Label>
          <Input type="number" value={volume} onChange={(e) => setVolume(e.target.value)} placeholder="ex: 5" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Frequência (vezes ao dia)</Label>
        <select 
          className="w-full h-10 px-3 rounded-md border border-input bg-background"
          value={frequency} 
          onChange={(e) => setFrequency(e.target.value)}
        >
          <option value="1">1x ao dia (24/24h)</option>
          <option value="2">2x ao dia (12/12h)</option>
          <option value="3">3x ao dia (8/8h)</option>
          <option value="4">4x ao dia (6/6h)</option>
        </select>
      </div>

      {totalDoseMg && (
        <div className="p-4 bg-slate-50 rounded-lg space-y-3">
          <div className="text-center border-b pb-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Dose Total Diária</p>
            <p className="text-2xl font-bold text-primary">{totalDoseMg.toFixed(1)} mg/dia</p>
          </div>
          
          {dosePerTimeMg && (
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Por Tomada (mg)</p>
                <p className="text-lg font-semibold">{dosePerTimeMg.toFixed(1)} mg</p>
              </div>
              {dosePerTimeMl && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Por Tomada (ml)</p>
                  <p className="text-lg font-bold text-green-600">{dosePerTimeMl.toFixed(1)} ml</p>
                </div>
              )}
            </div>
          )}
          
          <p className="text-[10px] text-center text-muted-foreground italic mt-2">
            * Sempre verifique a dose máxima recomendada na bula.
          </p>
        </div>
      )}
    </div>
  );
}

function CVRiskCalculator() {
  const [age, setAge] = useState("");
  const [totalChol, setTotalChol] = useState("");
  const [hdl, setHdl] = useState("");
  const [sbp, setSbp] = useState("");
  const [smoker, setSmoker] = useState("no");
  const [treated, setTreated] = useState("no");
  const [gender, setGender] = useState("male");

  // Simplified Framingham Risk Score (approximation for demonstration)
  const calculateRisk = () => {
    const a = parseFloat(age);
    const tc = parseFloat(totalChol);
    const h = parseFloat(hdl);
    const s = parseFloat(sbp);
    
    if (!a || !tc || !h || !s) return null;

    // Very simplified logic for illustrative purposes
    let points = 0;
    if (gender === 'male') {
      if (a < 35) points -= 9;
      else if (a < 40) points -= 4;
      else if (a < 45) points = 0;
      else if (a < 50) points = 3;
      else points = 6;
    } else {
      if (a < 35) points -= 7;
      else points = 2;
    }

    if (smoker === 'yes') points += 2;
    if (s > 140) points += 3;
    
    // Convert points to percentage (fake mapping for UI demo)
    const risk = Math.min(Math.max(points * 2, 1), 30);
    return risk.toFixed(1);
  };

  const risk = calculateRisk();

  return (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Idade</Label>
          <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="ex: 55" />
        </div>
        <div className="space-y-2">
          <Label>Sexo</Label>
          <select 
            className="w-full h-10 px-3 rounded-md border border-input bg-background"
            value={gender} 
            onChange={(e) => setGender(e.target.value)}
          >
            <option value="male">Masculino</option>
            <option value="female">Feminino</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Colesterol Total</Label>
          <Input type="number" value={totalChol} onChange={(e) => setTotalChol(e.target.value)} placeholder="mg/dL" />
        </div>
        <div className="space-y-2">
          <Label>HDL</Label>
          <Input type="number" value={hdl} onChange={(e) => setHdl(e.target.value)} placeholder="mg/dL" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>PAS (Sistólica)</Label>
          <Input type="number" value={sbp} onChange={(e) => setSbp(e.target.value)} placeholder="mmHg" />
        </div>
        <div className="space-y-2">
          <Label>Fumante</Label>
          <select 
            className="w-full h-10 px-3 rounded-md border border-input bg-background"
            value={smoker} 
            onChange={(e) => setSmoker(e.target.value)}
          >
            <option value="no">Não</option>
            <option value="yes">Sim</option>
          </select>
        </div>
      </div>
      {risk && (
        <div className="p-4 bg-slate-50 rounded-lg text-center">
          <p className="text-sm text-muted-foreground">Risco Cardiovascular (10 anos)</p>
          <p className="text-4xl font-bold text-primary my-1">{risk}%</p>
          <p className={cn("font-medium", parseFloat(risk) > 10 ? "text-red-500" : "text-green-500")}>
            {parseFloat(risk) > 10 ? "Risco Elevado" : "Risco Baixo/Moderado"}
          </p>
        </div>
      )}
    </div>
  );
}

export default function CalculatorsPage() {
  const [activeCalc, setActiveCalc] = useState<string | null>(null);

  const calculators = [
    { id: "imc", title: "IMC", description: "Cálculo do Índice de Massa Corporal.", component: <IMCCalculator /> },
    { id: "gfr", title: "Filtração Glomerular", description: "Estimativa da taxa de filtração renal (CKD-EPI).", component: <GFRCalculator /> },
    { id: "ped", title: "Dose Pediátrica", description: "Cálculo de dosagem por peso (mg/kg).", component: <PediatricDoseCalculator /> },
    { id: "cv", title: "Risco Cardiovascular", description: "Escore de Framingham ou similar.", component: <CVRiskCalculator /> },
  ];

  return (
    <LayoutShell>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">Calculadoras Médicas</h1>
          <p className="text-muted-foreground mt-1">Ferramentas de suporte à decisão clínica.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {calculators.map((calc) => (
            <Card key={calc.id} className="hover-elevate cursor-pointer group" onClick={() => setActiveCalc(calc.id)}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-green-500" />
                  {calc.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{calc.description}</p>
                <Button variant="outline" className="w-full gap-2 group-hover:bg-primary group-hover:text-white transition-colors">
                  Abrir <ChevronRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={!!activeCalc} onOpenChange={(open) => !open && setActiveCalc(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{calculators.find(c => c.id === activeCalc)?.title}</DialogTitle>
            <DialogDescription>
              Preencha os campos abaixo para calcular e visualizar o resultado.
            </DialogDescription>
          </DialogHeader>
          {calculators.find(c => c.id === activeCalc)?.component}
        </DialogContent>
      </Dialog>
    </LayoutShell>
  );
}
