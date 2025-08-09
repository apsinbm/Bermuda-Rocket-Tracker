import { LaunchWithVisibility } from '../types';
import { getLaunchTimingInfo } from './launchTimingUtils';

/**
 * Generate beginner-friendly rocket tracking explanation
 * Uses consistent timing logic with visibility calculations
 */
export function getTrackingExplanation(launch: LaunchWithVisibility): string {
  const timingInfo = getLaunchTimingInfo(launch.net);
  const direction = launch.visibility.trajectoryDirection;
  const likelihood = launch.visibility.likelihood;

  if (likelihood === 'none') {
    return "This rocket's path won't be visible from Bermuda.";
  }

  let explanation = "";

  // Time explanation using consistent timing logic
  explanation += `${timingInfo.icon} ${timingInfo.description} - ${timingInfo.trackingAdvice} `;

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
  explanation += "Start watching about 6 minutes after liftoff - timing and appearance will depend on lighting conditions.";

  return explanation;
}