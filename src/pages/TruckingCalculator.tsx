import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RateMode = "per_hour" | "per_load" | "per_ton" | "per_yard";

const fmtUSD = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

const num = (s: string) => {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

const TruckingCalculator = () => {
  const navigate = useNavigate();

  // Inputs
  const [rateMode, setRateMode] = useState<RateMode>("per_hour");
  const [rate, setRate] = useState("125");
  const [loads, setLoads] = useState("1");
  const [unitsPerLoad, setUnitsPerLoad] = useState("20"); // tons or yards per load
  const [oneWayMiles, setOneWayMiles] = useState("15");
  const [avgSpeedMph, setAvgSpeedMph] = useState("35");
  const [loadUnloadMin, setLoadUnloadMin] = useState("20"); // per round trip
  const [fuelPrice, setFuelPrice] = useState("4.10");
  const [mpg, setMpg] = useState("6");
  const [extraFees, setExtraFees] = useState("0");
  const [markupPct, setMarkupPct] = useState("15");

  const result = useMemo(() => {
    const r = num(rate);
    const ld = Math.max(1, num(loads));
    const upl = num(unitsPerLoad);
    const ow = num(oneWayMiles);
    const speed = Math.max(1, num(avgSpeedMph));
    const lu = num(loadUnloadMin);
    const fp = num(fuelPrice);
    const m = Math.max(0.1, num(mpg));
    const extras = num(extraFees);
    const markup = num(markupPct);

    const milesPerLoad = ow * 2;
    const driveHrsPerLoad = milesPerLoad / speed;
    const luHrsPerLoad = lu / 60;
    const hrsPerLoad = driveHrsPerLoad + luHrsPerLoad;
    const totalHours = hrsPerLoad * ld;
    const totalMiles = milesPerLoad * ld;
    const totalUnits = upl * ld;

    let baseCost = 0;
    switch (rateMode) {
      case "per_hour":
        baseCost = r * totalHours;
        break;
      case "per_load":
        baseCost = r * ld;
        break;
      case "per_ton":
      case "per_yard":
        baseCost = r * totalUnits;
        break;
    }

    const fuelCost = (totalMiles / m) * fp;
    const subtotal = baseCost + fuelCost + extras;
    const markupAmt = subtotal * (markup / 100);
    const total = subtotal + markupAmt;

    return {
      milesPerLoad,
      hrsPerLoad,
      totalHours,
      totalMiles,
      totalUnits,
      baseCost,
      fuelCost,
      extras,
      subtotal,
      markupAmt,
      total,
      perLoad: total / ld,
      perUnit: totalUnits > 0 ? total / totalUnits : 0,
    };
  }, [
    rateMode,
    rate,
    loads,
    unitsPerLoad,
    oneWayMiles,
    avgSpeedMph,
    loadUnloadMin,
    fuelPrice,
    mpg,
    extraFees,
    markupPct,
  ]);

  const reset = () => {
    setRateMode("per_hour");
    setRate("125");
    setLoads("1");
    setUnitsPerLoad("20");
    setOneWayMiles("15");
    setAvgSpeedMph("35");
    setLoadUnloadMin("20");
    setFuelPrice("4.10");
    setMpg("6");
    setExtraFees("0");
    setMarkupPct("15");
  };

  const unitLabel =
    rateMode === "per_ton" ? "tons" : rateMode === "per_yard" ? "yards" : "tons / yards";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/tools")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-1 items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <div>
              <h1 className="font-display text-lg font-semibold">Trucking Price Calculator</h1>
              <p className="text-xs text-muted-foreground">Estimate haul cost</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="mr-1 h-4 w-4" /> Reset
          </Button>
        </div>
      </header>

      <main className="mx-auto grid max-w-3xl gap-4 px-4 py-5 md:grid-cols-2">
        {/* Inputs */}
        <Card className="space-y-3 p-4">
          <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Inputs
          </h2>

          <div>
            <Label>Rate basis</Label>
            <Select value={rateMode} onValueChange={(v) => setRateMode(v as RateMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="per_hour">Per hour</SelectItem>
                <SelectItem value="per_load">Per load</SelectItem>
                <SelectItem value="per_ton">Per ton</SelectItem>
                <SelectItem value="per_yard">Per yard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>
                Rate ($/
                {rateMode === "per_hour"
                  ? "hr"
                  : rateMode === "per_load"
                  ? "load"
                  : rateMode === "per_ton"
                  ? "ton"
                  : "yd"}
                )
              </Label>
              <Input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
            </div>
            <div>
              <Label># of loads</Label>
              <Input inputMode="numeric" value={loads} onChange={(e) => setLoads(e.target.value)} />
            </div>
          </div>

          {(rateMode === "per_ton" || rateMode === "per_yard") && (
            <div>
              <Label>Units per load ({unitLabel})</Label>
              <Input
                inputMode="decimal"
                value={unitsPerLoad}
                onChange={(e) => setUnitsPerLoad(e.target.value)}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>One-way miles</Label>
              <Input
                inputMode="decimal"
                value={oneWayMiles}
                onChange={(e) => setOneWayMiles(e.target.value)}
              />
            </div>
            <div>
              <Label>Avg speed (mph)</Label>
              <Input
                inputMode="decimal"
                value={avgSpeedMph}
                onChange={(e) => setAvgSpeedMph(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Load + unload time per round trip (min)</Label>
            <Input
              inputMode="numeric"
              value={loadUnloadMin}
              onChange={(e) => setLoadUnloadMin(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Fuel price ($/gal)</Label>
              <Input
                inputMode="decimal"
                value={fuelPrice}
                onChange={(e) => setFuelPrice(e.target.value)}
              />
            </div>
            <div>
              <Label>Truck MPG</Label>
              <Input inputMode="decimal" value={mpg} onChange={(e) => setMpg(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Extra fees ($)</Label>
              <Input
                inputMode="decimal"
                value={extraFees}
                onChange={(e) => setExtraFees(e.target.value)}
              />
            </div>
            <div>
              <Label>Markup (%)</Label>
              <Input
                inputMode="decimal"
                value={markupPct}
                onChange={(e) => setMarkupPct(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Result */}
        <Card className="space-y-3 p-4">
          <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
            Estimate
          </h2>

          <div className="rounded-lg bg-primary/10 p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Total price
            </div>
            <div className="font-display text-3xl font-bold text-primary">
              {fmtUSD(result.total)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {fmtUSD(result.perLoad)} / load
              {result.perUnit > 0 && (
                <>
                  {" · "}
                  {fmtUSD(result.perUnit)} / {rateMode === "per_yard" ? "yd" : "ton"}
                </>
              )}
            </div>
          </div>

          <ul className="divide-y text-sm">
            <Row label="Miles per load" value={`${result.milesPerLoad.toFixed(1)} mi`} />
            <Row label="Hours per load" value={`${result.hrsPerLoad.toFixed(2)} hr`} />
            <Row label="Total hours" value={`${result.totalHours.toFixed(2)} hr`} />
            <Row label="Total miles" value={`${result.totalMiles.toFixed(1)} mi`} />
            {(rateMode === "per_ton" || rateMode === "per_yard") && (
              <Row
                label={`Total ${rateMode === "per_yard" ? "yards" : "tons"}`}
                value={result.totalUnits.toFixed(2)}
              />
            )}
            <Row label="Base cost" value={fmtUSD(result.baseCost)} />
            <Row label="Fuel cost" value={fmtUSD(result.fuelCost)} />
            <Row label="Extras" value={fmtUSD(result.extras)} />
            <Row label="Subtotal" value={fmtUSD(result.subtotal)} />
            <Row label={`Markup (${markupPct || 0}%)`} value={fmtUSD(result.markupAmt)} />
          </ul>

          <p className="text-[11px] text-muted-foreground">
            Estimate only — confirm rates and fees with the office before quoting.
          </p>
        </Card>
      </main>
    </div>
  );
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <li className="flex items-center justify-between py-2">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium tabular-nums">{value}</span>
  </li>
);

export default TruckingCalculator;
