import type { LinkOpener } from '../../providers/RideAppProvider';

/** Records links instead of leaving the app. `refuse` lists links that "will not open". */
export class MockLinkOpener implements LinkOpener {
  readonly opened: string[] = [];
  constructor(private readonly refuse: (url: string) => boolean = () => false) {}

  async open(url: string): Promise<boolean> {
    if (this.refuse(url)) return false;
    this.opened.push(url);
    return true;
  }
}
