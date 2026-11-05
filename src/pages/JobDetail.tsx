import { JobFilesSection } from "@/components/jobs/JobFilesSection";
import { JobDetailTabs } from "@/components/jobs/JobDetailTabs";
import { JobStatusBadge } from "@/components/jobs/JobStatusBadge";
import { JobStatusSection } from "@/components/jobs/JobStatusSection";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Phone, User, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/access";
import { useWeather } from "@/hooks/useWeather";
import { WeatherCard } from "@/components/weather/WeatherCard";
import { geocodeAddress } from "@/lib/weather";
import { Button } from "@/components/ui/button";
import { DigTicketsSection } from "@/components/jobs/DigTicketsSection";
import { PermitsSection } from "@/components/jobs/PermitsSection";
import { PlansSection } from "@/components/jobs/PlansSection";
import { PhotosSection } from "@/components/jobs/PhotosSection";
import { JobInfoSection } from "@/components/jobs/JobInfoSection";
import { JobLookahead } from "@/components/jobs/JobLookahead";
import { LookaheadGrid } from "@/components/jobs/lookahead/LookaheadGrid";
import { SafetyInspectionButton } from "@/components/jobs/SafetyInspectionButton";
import { RequestTruckButton } from "@/components/jobs/RequestTruckButton";
import { ForemanPicker } from "@/components/jobs/ForemanPicker";
import { JobContactsSection } from "@/components/jobs/JobContactsSection";
import { DriveTimeFromShop } from "@/components/jobs/DriveTimeFromShop";
import { ContractSection } from "@/components/jobs/ContractSection";
import { ForemanBriefSection } from "@/components/jobs/ForemanBriefSection";
import { ScopeOfWorkSection } from "@/components/jobs/ScopeOfWorkSection";
import { SubmittalsSection } from "@/components/jobs/SubmittalsSection";
import { SwpppSection } from "@/components/jobs/SwpppSection";
import { AccidentReportButton } from "@/components/safety/AccidentReportDialog";
import { SafetyViolationButton } from "@/components/safety/SafetyViolationDialog";

interface Job {
  id: string;
  job_number: string | null;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: "active" | "on_hold" | "complete";
  customer: string | null;
  gc: string | null;
  on_site_contact_name: string | null;
  on_site_contact_phone: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  foreman_id: string | null;
  hold_reason: string | null;
  completed_at: string | null;
  completed_by: string | null;
  lookahead_grid_enabled?: boolean;
}

const JobDetail = () => {
  const { id } = useParams();
  const { can } = useAccess();
  const canSeePrivate = can("jobs.private.view");
  const canSeeJobReport = can("jobs.report.view");
  const canChangeStatus = can("jobs.edit");
  const canSeeContract = can("job.contract.view");
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    supabase.from("jobs").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      setJob(data as Job | null);
      setLoading(false);
    });
  }, [id]);

  const [geocoded, setGeocoded] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    if (!job) return;
    if (Number.isFinite(job.latitude) && Number.isFinite(job.longitude)) { setGeocoded(null); return; }
    if (!job.address) return;
    let cancelled = false;
    (async () => {
      try {
        const location = await geocodeAddress(job.address!);
        if (cancelled || !location) return;
        const { lat, lon } = location;
        setGeocoded({ lat, lon });
        setJob((current) => current?.id === job.id ? { ...current, latitude: lat, longitude: lon } : current);
        // Persist for next time
        await supabase.from("jobs").update({ latitude: lat, longitude: lon }).eq("id", job.id);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [job?.id, job?.address, job?.latitude, job?.longitude]);

  const lat = job?.latitude ?? geocoded?.lat ?? null;
  const lon = job?.longitude ?? geocoded?.lon ?? null;
  const coords = Number.isFinite(lat) && Number.isFinite(lon)
    ? { lat, lon, label: job?.address ?? job?.name ?? "" }
    : null;
  const weather = useWeather(coords);

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!job) return <div className="p-8 text-center text-sm">Job not found.</div>;

  const mapsUrl = job.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`
    : null;
  const lookaheadEnabled = job.lookahead_grid_enabled === true;

  const statusSection = (
    <JobStatusSection
      job={job}
      canChangeStatus={canChangeStatus}
      onChanged={(fields) => setJob((current) => (current ? { ...current, ...fields } : current))}
    />
  );
  const filesSection = <JobFilesSection jobId={job.id} />;
  const driveSection = <DriveTimeFromShop lat={lat} lon={lon} />;
  const weatherSection = coords ? (
    <section>
      <h2 className="mb-2 font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
        Weather on site
      </h2>
      <WeatherCard forecast={weather.forecast} coords={weather.coords} loading={weather.loading} />
    </section>
  ) : (
    <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
      Add an address to see on-site weather.
    </div>
  );
  const privateSection = canSeePrivate ? (
    <section className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <h2 className="font-display text-xs uppercase tracking-[0.22em] text-muted-foreground">
        Job details
      </h2>
      {job.customer && <Row label="Customer" value={job.customer} />}
      {job.gc && <Row label="GC" value={job.gc} />}
      <ForemanPicker
        jobId={job.id}
        foremanId={job.foreman_id}
        onChange={(newId) => setJob((current) => (current ? { ...current, foreman_id: newId } : current))}
      />
      {job.on_site_contact_name && (
        <Row icon={<User className="h-3.5 w-3.5" />} label="On-site" value={job.on_site_contact_name} />
      )}
      {job.on_site_contact_phone && (
        <a href={`tel:${job.on_site_contact_phone}`} className="block">
          <Row icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={job.on_site_contact_phone} />
        </a>
      )}
      {(job.start_date || job.end_date) && (
        <Row
          icon={<Calendar className="h-3.5 w-3.5" />}
          label="Dates"
          value={`${job.start_date ?? "?"} → ${job.end_date ?? "?"}`}
        />
      )}
      {job.notes && (
        <div className="pt-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Notes</p>
          <p className="text-sm">{job.notes}</p>
        </div>
      )}
    </section>
  ) : null;
  const contactsSection = canSeePrivate ? (
    <JobContactsSection jobId={job.id} jobName={job.name} foremanId={job.foreman_id} />
  ) : null;
  const contractSection = canSeeContract ? <ContractSection jobId={job.id} /> : null;
  const briefSection = canSeePrivate ? <ForemanBriefSection jobId={job.id} /> : null;
  const scopeSection = <ScopeOfWorkSection jobId={job.id} />;
  const submittalsSection = <SubmittalsSection jobId={job.id} />;
  const swpppSection = <SwpppSection jobId={job.id} jobNumber={job.job_number} />;
  const reportSection = canSeeJobReport ? <JobInfoSection jobNumber={job.job_number} /> : null;
  const crewSection = <JobLookahead jobId={job.id} />;
  const plansSection = <PlansSection jobId={job.id} />;
  const photosSection = (
    <PhotosSection
      jobId={job.id}
      jobLabel={job.job_number ? `#${job.job_number} · ${job.name}` : job.name}
      address={job.address}
    />
  );
  const permitsSection = <PermitsSection jobId={job.id} />;
  const digSection = <DigTicketsSection jobId={job.id} />;
  const truckSection = job.status === "active" ? (
    <RequestTruckButton jobId={job.id} jobAddress={job.address} />
  ) : null;
  const inspectionSection = <SafetyInspectionButton jobId={job.id} />;
  const accidentSection = (
    <AccidentReportButton presetJob={{ id: job.id, name: job.name, job_number: job.job_number }} variant="outline" />
  );
  const violationSection = canSeePrivate ? (
    <SafetyViolationButton presetJob={{ id: job.id, name: job.name, job_number: job.job_number }} variant="outline" />
  ) : null;
  const mapsSection = mapsUrl ? (
    <Button asChild variant="outline" className="w-full">
      <a href={mapsUrl} target="_blank" rel="noreferrer">Open in Maps</a>
    </Button>
  ) : null;

  return (
    <div className="min-h-screen bg-background">
      <div className={`mx-auto space-y-5 px-4 py-6 ${lookaheadEnabled ? "max-w-6xl" : "max-w-2xl"}`}>
        <Link to="/jobs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All jobs
        </Link>

        <div>
          <div className="flex items-center gap-2">
            {job.job_number && <span className="text-xs font-mono text-muted-foreground">#{job.job_number}</span>}
            <JobStatusBadge status={job.status} />
          </div>
          <h1 className="mt-1 font-display text-2xl uppercase tracking-wide">{job.name}</h1>
          {job.address && (
            <a
              href={mapsUrl ?? "#"}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <MapPin className="h-4 w-4" /> {job.address}
            </a>
          )}
        </div>

        {lookaheadEnabled ? (
          <JobDetailTabs
            lookahead={(
              <>
                <LookaheadGrid jobId={job.id} jobName={job.name} jobNumber={job.job_number} />
                {crewSection}
              </>
            )}
            jobInfo={(
              <>
                {statusSection}
                {privateSection}
                {contactsSection}
                {contractSection}
                {briefSection}
                {scopeSection}
                {submittalsSection}
                {swpppSection}
                {reportSection}
                {weatherSection}
                {driveSection}
                {mapsSection}
              </>
            )}
            files={(
              <>
                {filesSection}
                {plansSection}
                {photosSection}
              </>
            )}
            field={(
              <>
                {digSection}
                {permitsSection}
                {truckSection}
                {inspectionSection}
                {accidentSection}
                {violationSection}
              </>
            )}
          />
        ) : (
          <>
            {statusSection}
            {filesSection}
            {driveSection}
            {weatherSection}
            {privateSection}
            {contactsSection}
            {contractSection}
            {briefSection}
            {scopeSection}
            {submittalsSection}
            {swpppSection}
            {reportSection}
            {crewSection}
            {plansSection}
            {photosSection}
            {permitsSection}
            {digSection}
            {truckSection}
            {inspectionSection}
            {accidentSection}
            {violationSection}
            {mapsSection}
          </>
        )}
      </div>
    </div>
  );
};

const Row = ({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) => (
  <div className="flex items-center justify-between gap-3 text-sm">
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {icon} {label}
    </span>
    <span className="text-right truncate">{value}</span>
  </div>
);

export default JobDetail;
