import React from "react";
import { CameraView } from "@backend/common/schemas/studio";

export interface IsometricPresetOption {
  id: CameraView["preset"];
  titleKey:
    | "presetIsometricOptions.isoTfr"
    | "presetIsometricOptions.isoTfl"
    | "presetIsometricOptions.isoTbr"
    | "presetIsometricOptions.isoTbl"
    | "presetIsometricOptions.isoBfr"
    | "presetIsometricOptions.isoBfl"
    | "presetIsometricOptions.isoBbr"
    | "presetIsometricOptions.isoBbl";
  icon: React.ReactNode;
}

export const ISOMETRIC_PRESETS: IsometricPresetOption[] = [
  { id: 'iso-tfr', titleKey: 'presetIsometricOptions.isoTfr', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="10" y="4" width="10" height="10" strokeOpacity={0.3} /><path d="M10 4l-6 6M20 4l-6 6M10 14l-6 6M20 14l-6 6" strokeOpacity={0.3} /><rect x="4" y="10" width="10" height="10" /><circle cx="14" cy="10" r="2.5" fill="#ef4444" stroke="none" /></svg> },
  { id: 'iso-tfl', titleKey: 'presetIsometricOptions.isoTfl', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="10" y="4" width="10" height="10" strokeOpacity={0.3} /><path d="M10 4l-6 6M20 4l-6 6M10 14l-6 6M20 14l-6 6" strokeOpacity={0.3} /><rect x="4" y="10" width="10" height="10" /><circle cx="4" cy="10" r="2.5" fill="#ef4444" stroke="none" /></svg> },
  { id: 'iso-tbr', titleKey: 'presetIsometricOptions.isoTbr', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="10" y="4" width="10" height="10" strokeOpacity={0.3} /><path d="M10 4l-6 6M20 4l-6 6M10 14l-6 6M20 14l-6 6" strokeOpacity={0.3} /><rect x="4" y="10" width="10" height="10" /><circle cx="20" cy="4" r="2.5" fill="#ef4444" stroke="none" /></svg> },
  { id: 'iso-tbl', titleKey: 'presetIsometricOptions.isoTbl', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="10" y="4" width="10" height="10" strokeOpacity={0.3} /><path d="M10 4l-6 6M20 4l-6 6M10 14l-6 6M20 14l-6 6" strokeOpacity={0.3} /><rect x="4" y="10" width="10" height="10" /><circle cx="10" cy="4" r="2.5" fill="#ef4444" stroke="none" /></svg> },
  { id: 'iso-bfr', titleKey: 'presetIsometricOptions.isoBfr', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="10" y="4" width="10" height="10" strokeOpacity={0.3} /><path d="M10 4l-6 6M20 4l-6 6M10 14l-6 6M20 14l-6 6" strokeOpacity={0.3} /><rect x="4" y="10" width="10" height="10" /><circle cx="14" cy="20" r="2.5" fill="#ef4444" stroke="none" /></svg> },
  { id: 'iso-bfl', titleKey: 'presetIsometricOptions.isoBfl', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="10" y="4" width="10" height="10" strokeOpacity={0.3} /><path d="M10 4l-6 6M20 4l-6 6M10 14l-6 6M20 14l-6 6" strokeOpacity={0.3} /><rect x="4" y="10" width="10" height="10" /><circle cx="4" cy="20" r="2.5" fill="#ef4444" stroke="none" /></svg> },
  { id: 'iso-bbr', titleKey: 'presetIsometricOptions.isoBbr', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="10" y="4" width="10" height="10" strokeOpacity={0.3} /><path d="M10 4l-6 6M20 4l-6 6M10 14l-6 6M20 14l-6 6" strokeOpacity={0.3} /><rect x="4" y="10" width="10" height="10" /><circle cx="20" cy="14" r="2.5" fill="#ef4444" stroke="none" /></svg> },
  { id: 'iso-bbl', titleKey: 'presetIsometricOptions.isoBbl', icon: <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="10" y="4" width="10" height="10" strokeOpacity={0.3} /><path d="M10 4l-6 6M20 4l-6 6M10 14l-6 6M20 14l-6 6" strokeOpacity={0.3} /><rect x="4" y="10" width="10" height="10" /><circle cx="10" cy="14" r="2.5" fill="#ef4444" stroke="none" /></svg> },
];
