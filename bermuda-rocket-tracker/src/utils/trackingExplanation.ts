import { LaunchWithVisibility } from '../types';

/**
 * Generate beginner-friendly rocket tracking explanation
 */
export function getTrackingExplanation(launch: LaunchWithVisibility): string {
  const isNight = isNightTime(launch.net);
  const direction = launch.visibility.trajectoryDirection;
  const likelihood = launch.visibility.likelihood;

  if (likelihood === 'none') {
    return "This rocket's path won't be visible from Bermuda.";
  }

  let explanation = "";

  // Time explanation
  if (isNight) {
    explanation += "🌙 Night launch - look for a bright moving star climbing slowly across the sky. ";
  } else {
    explanation += "☀️ Daytime launch - very difficult to spot against the bright blue sky. ";
  }

  // Direction explanation - corrected for proper viewing from Bermuda
  if (direction === 'Northeast') {
    explanation += "The rocket will travel northeast from Florida (53°+ inclination orbit like Starlink/ISS). From Bermuda, start looking southwest to see it coming, then track it as it passes west, then northwest, then north, then northeast overhead. ";
  } else if (direction === 'East-Northeast') {
    explanation += "The rocket will travel east-northeast from Florida. From Bermuda, start looking west-southwest to see it coming, then track it as it passes west, then northwest, then north, then northeast. ";
  } else if (direction === 'East') {
    explanation += "The rocket will travel due east from Florida. From Bermuda, start looking west to see it coming, then track it overhead as it passes east. ";
  } else if (direction === 'East-Southeast') {
    explanation += "The rocket will travel east-southeast from Florida. From Bermuda, start looking west-southwest to see it coming, then track it as it passes southwest, then south, then southeast. ";
  } else if (direction === 'Southeast') {
    explanation += "The rocket will travel southeast from Florida. From Bermuda, start looking west-southwest to see it coming, then track it as it passes southwest, then south, then southeast. ";
  }

  // Timing explanation
  if (isNight) {
    explanation += "Start watching about 6 minutes after liftoff - the rocket will appear as a bright dot moving steadily across the sky, potentially with a glowing exhaust plume behind it.";
  } else {
    explanation += "If visible at all, it may appear as a faint contrail or bright speck moving across the sky.";
  }

  return explanation;
}

/**
 * Check if launch is at night (simplified)
 */
function isNightTime(launchTime: string): boolean {
  const date = new Date(launchTime);
  const hour = date.getHours();
  return hour < 6 || hour > 20;
}