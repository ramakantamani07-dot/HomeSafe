import {
  decodePlaceId,
  encodePlaceId,
  toSuggestions,
} from '../implementations/places/MapKitPlacesProvider';

describe('MapKit search suggestions', () => {
  it('turns places and addresses into rows, with the place name first', () => {
    const rows = toSuggestions([
      { title: "King's College Hospital", subtitle: 'Denmark Hill, London, SE5 9RS' },
      { title: '12 Rye Lane', subtitle: 'London, SE15 5BY' },
    ]);
    expect(rows.map((r) => [r.primaryText, r.secondaryText])).toEqual([
      ["King's College Hospital", 'Denmark Hill, London, SE5 9RS'],
      ['12 Rye Lane', 'London, SE15 5BY'],
    ]);
    // No coordinates yet: resolved on tap, and never shown as "0 km".
    expect(rows.every((r) => r.resolved === null && r.distanceMeters === null)).toBe(true);
  });

  it('leaves out "search nearby" suggestions and anything without an address', () => {
    const rows = toSuggestions([
      { title: 'Coffee', subtitle: 'Search Nearby' },
      { title: 'Pharmacy', subtitle: '' },
      { title: '', subtitle: 'London' },
      { title: 'Peckham Library', subtitle: '122 Peckham Hill St, London' },
    ]);
    expect(rows.map((r) => r.primaryText)).toEqual(['Peckham Library']);
  });

  it('drops a suggestion MapKit repeats', () => {
    const rows = toSuggestions([
      { title: 'Peckham Rye', subtitle: 'London' },
      { title: 'peckham rye', subtitle: 'london' },
    ]);
    expect(rows).toHaveLength(1);
  });

  it('round-trips a suggestion through its id, commas and all', () => {
    const completion = { title: "St Thomas' Hospital", subtitle: 'Westminster Bridge Rd, London, SE1 7EH' };
    expect(decodePlaceId(encodePlaceId(completion))).toEqual(completion);
  });
});
