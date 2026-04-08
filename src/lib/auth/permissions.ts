type KemenkoAccessibleProfile = {
  role: string;
  can_access_kemenko_report?: boolean;
};

export function canAccessKemenkoReports(profile: KemenkoAccessibleProfile) {
  return profile.role === "menko" || profile.can_access_kemenko_report === true;
}

type AdminProfile = {
  role?: string;
  is_pj_kemenkoan?: boolean;
};

export function canInputDetailKegiatan(profile: AdminProfile) {
  return profile.role === "admin" || profile.is_pj_kemenkoan === true;
}

export function getAdminTypeLabel(profile: AdminProfile) {
  if (profile.is_pj_kemenkoan) {
    return "PJ Kemenkoan";
  }
  return "PJ Kementerian";
}