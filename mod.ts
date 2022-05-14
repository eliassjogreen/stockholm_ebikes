import type { GeoJSON } from "./deps.ts";

const baseURL = "https://stockholmebikes.se/";

export class StockholmEBikesSession {
  static async authenticate(
    email: string,
    password: string,
  ): Promise<StockholmEBikesSession> {
    const body = new URLSearchParams();
    body.set("email", email);
    body.set("password", password);

    const response = await fetch(
      new URL("/login?_data=routes/login", baseURL).href,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );

    if (response.status === 204) {
      const cookies: Record<string, string> = {};
      for (const [name, value] of response.headers.entries()) {
        if (name === "set-cookie") {
          const [cookie, content] = value.split(";")[0].split("=");
          cookies[cookie] = content;
        }
      }

      return new StockholmEBikesSession(cookies);
    }

    if (
      response.status === 200 &&
      response.headers.get("content-type")?.startsWith("application/json")
    ) {
      const json = await response.json();
      throw new Error(json);
    }

    throw new Error(
      `Unknown error when attempting to authenticate. Status ${response.status}, body ${await response
        .text()}`,
    );
  }

  cookies: Record<string, string>;

  constructor(cookies: Record<string, string>) {
    this.cookies = cookies;
  }

  async validate(): Promise<boolean> {
    const response = await fetch(
      new URL("/?_data=routes/index", baseURL).href,
      {
        method: "GET",
        headers: {
          "Cookie": this.getCookie(),
        },
      },
    );

    return response.ok && (await response.json())["isLoggedIn"] === true;
  }

  getCookie(): string {
    return Object.entries(this.cookies).map(([cookie, content]) =>
      `${cookie}=${content}`
    ).join(";");
  }
}

export class StockholmEBikes {
  session?: StockholmEBikesSession;

  constructor(session?: StockholmEBikesSession) {
    this.session = session;
  }

  async #fetch(input: string, init?: RequestInit | undefined): Promise<Response> {
    if (this.session !== undefined) {
      init ??= {};
      init.headers ??= {};
      (init.headers as { [name: string]: string })["Cookie"] = this.session
        .getCookie();
    }

    const response = await fetch(new URL(input, baseURL).href, init);

    if (response.ok) {
      return response;
    }

    throw new Error(await response.json());
  }

  async map() {
    return await (await this.#fetch("/map?_data=routes/map")).json();
  }

  async detail(id: string) {
    return await (await this.#fetch(`/map/detail/${id}?_data=routes/map/detail.$optionId`)).json();
  }

  async trips() {
    return await (await this.#fetch("/app/my-trips?_data=routes/app/my-trips")).json();
  }

  async wallet() {
    return await (await this.#fetch("/app/wallet?_data=routes/app/wallet")).json();
  }

  async account() {
    return await (await this.#fetch("/app/profile?_data=routes/app/profile")).json();
  }

  async area(): Promise<GeoJSON.FeatureCollection> {
    return JSON.parse((await this.map()).mainServiceArea.attributes.geojson);
  }

  // async mobilityOptions(): Promise<MobilityOptions> {
  //   return (await this.map()).mobilityOptions;
  // }
}
