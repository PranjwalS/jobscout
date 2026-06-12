export type JobType = "full-time" | "part-time" | "co-op" | "internship" | "contract";
export type Season = "fall_2026" | "winter_2027" | "spring_2027" | "summer_2027";
export type SalaryType = "hourly" | "weekly" | "monthly" | "yearly";
export type SkillVote = "include" | "neutral" | "exclude";
export type FilterMode = "preference" | "hard";

export interface SalaryConfig {
  type: SalaryType;
  min?: number;
  max?: number;
}

export interface DateRange {
  start?: string;
  end?: string;
}

export interface WizardFormState {
  // Step 1
  name: string;
  description: string;
  job_types: JobType[];

  // Step 2
  include_fields: string[];
  exclude_fields: string[];

  // Step 3
  include_skills: string[];
  exclude_skills: string[];

  // Step 4
  include_locations: string[];
  exclude_locations: string[];
  location_mode: FilterMode;
  include_companies: string[];
  exclude_companies: string[];
  company_mode: FilterMode;

  // Step 5
  salary?: SalaryConfig;
  seasons: Season[];
  work_term_duration?: string;
  date_range?: DateRange;
}

export const EMPTY_FORM: WizardFormState = {
  name: "",
  description: "",
  job_types: [],
  include_fields: [],
  exclude_fields: [],
  include_skills: [],
  exclude_skills: [],
  include_locations: [],
  exclude_locations: [],
  location_mode: "preference",
  include_companies: [],
  exclude_companies: [],
  company_mode: "preference",
  seasons: [],
};

export const SEASON_LABELS: Record<Season, string> = {
  fall_2026: "Fall 2026",
  winter_2027: "Winter 2027",
  spring_2027: "Spring 2027",
  summer_2027: "Summer 2027",
};

export const JOB_TYPE_LABELS: Record<JobType, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  "co-op": "Co-op",
  internship: "Internship",
  contract: "Contract",
};

export const WORK_DURATIONS = ["4 months", "8 months", "12 months", "16 months"];