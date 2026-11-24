export function postAuthPath(user) {
  if (!user) return '/login';
  if (!user.onboardingCompleted) return '/onboarding';
  if (!user.featureIntroSeen) return '/feature-intro';
  return '/app';
}
