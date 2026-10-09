import { sosFallbackText } from '../models/SOS';

test('the offline SOS text carries a map link, not bare coordinates', () => {
  expect(sosFallbackText({ latitude: 51.507351, longitude: -0.127758 })).toBe(
    "I need help. I'm near https://maps.google.com/?q=51.50735,-0.12776\n(Sent from wayLoc — it couldn't reach the internet.)",
  );
});

test('without a location it still asks for help, and claims nothing', () => {
  expect(sosFallbackText(null)).toBe("I need help.\n(Sent from wayLoc — it couldn't reach the internet.)");
});
