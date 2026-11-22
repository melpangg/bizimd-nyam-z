let welcomeHeartsPending = false;

export const welcomeHeartsEvent = "welcome-hearts";

export function markWelcomeHeartsPending(person: "emre" | "elif") {
  welcomeHeartsPending = person === "elif";
}

export function consumeWelcomeHeartsPending() {
  const pending = welcomeHeartsPending;
  welcomeHeartsPending = false;
  return pending;
}
