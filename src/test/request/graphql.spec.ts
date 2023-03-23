import { sendHttp, initFileProvider } from '../testUtils';
import dedent from 'dedent-js';
import { getLocal } from 'mockttp';

describe('request.graphql', () => {
  const localServer = getLocal();
  beforeEach(() => localServer.start(7002));
  afterEach(() => localServer.stop());

  it('query + operation + variables', async () => {
    initFileProvider();
    const mockedEndpoints = await localServer.forPost('/graphql').thenReply(200);

    await sendHttp(`
POST  http://localhost:7002/graphql

query launchesQuery($limit: Int!){
  launchesPast(limit: $limit) {
    mission_name
    launch_date_local
    launch_site {
      site_name_long
    }
    rocket {
      rocket_name
      rocket_type
    }
    ships {
      name
      home_port
      image
    }
  }
}

{
    "limit": 10
}
      `);

    const requests = await mockedEndpoints.getSeenRequests();
    expect(requests[0].url).toBe('http://localhost:7002/graphql');
    expect(await requests[0].body.getText()).toBe(
      '{"query":"query launchesQuery($limit: Int!){\\n  launchesPast(limit: $limit) {\\n    mission_name\\n    launch_date_local\\n    launch_site {\\n      site_name_long\\n    }\\n    rocket {\\n      rocket_name\\n      rocket_type\\n    }\\n    ships {\\n      name\\n      home_port\\n      image\\n    }\\n  }\\n}","operationName":"launchesQuery","variables":{"limit":10}}'
    );
  });

  it('query with fragment', async () => {
    initFileProvider();
    const mockedEndpoints = await localServer.forPost('/graphql').thenReply(200);

    await sendHttp(dedent`
        fragment First on Stage {
          cores {
            flight
            core {
              reuse_count
              status
            }
          }
        }
        fragment RocketParts on LaunchRocket {
          rocket_name
          first_stage {
            ...First
          }
        }
        fragment LaunchSiteInfo on LaunchSite {
          site_name_long
        }

        POST http://localhost:7002/graphql HTTP/1.1
        Content-Type: application/json


        query launchesQuery($limit: Int!){
          launchesPast(limit: $limit) {
            mission_name
            launch_date_local
            launch_site {
              ...LaunchSiteInfo
            }
            rocket {
              ...RocketParts
            }
          }
        }

        {
            "limit": 10
        }
      `);

    const requests = await mockedEndpoints.getSeenRequests();
    expect(requests[0].url).toBe('http://localhost:7002/graphql');
    const body = await requests[0].body.getJson();
    expect(body).toStrictEqual({
      query: dedent`
        query launchesQuery($limit: Int!){
          launchesPast(limit: $limit) {
            mission_name
            launch_date_local
            launch_site {
              ...LaunchSiteInfo
            }
            rocket {
              ...RocketParts
            }
          }
        }
        fragment RocketParts on LaunchRocket {
          rocket_name
          first_stage {
            ...First
          }
        }
        fragment First on Stage {
          cores {
            flight
            core {
              reuse_count
              status
            }
          }
        }
        fragment LaunchSiteInfo on LaunchSite {
          site_name_long
        }`,
      operationName: 'launchesQuery',
      variables: { limit: 10 },
    });
  });

  it('only query', async () => {
    initFileProvider();
    const mockedEndpoints = await localServer.forPost('/graphql').thenReply(200);

    await sendHttp(`
POST http://localhost:7002/graphql
Content-Type: application/json

query company_query {
  company {
    coo
  }
}
      `);

    const requests = await mockedEndpoints.getSeenRequests();
    expect(requests[0].url).toBe('http://localhost:7002/graphql');
    expect(await requests[0].body.getText()).toBe(
      '{"query":"query company_query {\\n  company {\\n    coo\\n  }\\n}","operationName":"company_query"}'
    );
  });

  it('imported query', async () => {
    initFileProvider({
      'graphql.gql': `
query launchesQuery($limit: Int!){
  launchesPast(limit: $limit) {
    mission_name
    launch_date_local
    launch_site {
      site_name_long
    }
    rocket {
      rocket_name
      rocket_type
    }
    ships {
      name
      home_port
      image
    }
  }
}
        `,
    });
    const mockedEndpoints = await localServer.forPost('/graphql').thenReply(200);

    await sendHttp(`
POST http://localhost:7002/graphql
Content-Type: application/json

gql launchesQuery < ./graphql.gql

{
    "limit": 10
}
      `);

    const requests = await mockedEndpoints.getSeenRequests();
    expect(requests[0].url).toBe('http://localhost:7002/graphql');
    expect(await requests[0].body.getText()).toBe(
      '{"query":"\\nquery launchesQuery($limit: Int!){\\n  launchesPast(limit: $limit) {\\n    mission_name\\n    launch_date_local\\n    launch_site {\\n      site_name_long\\n    }\\n    rocket {\\n      rocket_name\\n      rocket_type\\n    }\\n    ships {\\n      name\\n      home_port\\n      image\\n    }\\n  }\\n}\\n        ","operationName":"launchesQuery","variables":{"limit":10}}'
    );
  });

  it('imported fragments', async () => {
    initFileProvider({
      'fragments.gql': dedent`
          fragment First on Stage {
            cores {
              flight
              core {
                reuse_count
                status
              }
            }
          }
          fragment RocketParts on LaunchRocket {
            rocket_name
            first_stage {
              ...First
            }
          }
          fragment LaunchSiteInfo on LaunchSite {
            site_name_long
          }
        `,
    });

    const mockedEndpoints = await localServer.forPost('/graphql').thenReply(200);
    await sendHttp(dedent`

      gql RocketParts < ./fragments.gql

      POST http://localhost:7002/graphql
      Content-Type: application/js

      query launchesQuery($limit: Int!){
        launchesPast(limit: $limit) {
          mission_name
          launch_date_local
          launch_site {
            ...LaunchSiteInfo
          }
          rocket {
            ...RocketParts
          }
        }
      }

      {
          "limit": 10
      }
    `);

    const requests = await mockedEndpoints.getSeenRequests();
    expect(requests[0].url).toBe('http://localhost:7002/graphql');
    const body = await requests[0].body.getJson();
    expect(body).toStrictEqual({
      query: dedent`
        query launchesQuery($limit: Int!){
          launchesPast(limit: $limit) {
            mission_name
            launch_date_local
            launch_site {
              ...LaunchSiteInfo
            }
            rocket {
              ...RocketParts
            }
          }
        }
        fragment First on Stage {
          cores {
            flight
            core {
              reuse_count
              status
            }
          }
        }
        fragment RocketParts on LaunchRocket {
          rocket_name
          first_stage {
            ...First
          }
        }
        fragment LaunchSiteInfo on LaunchSite {
          site_name_long
        }`,
      operationName: 'launchesQuery',
      variables: { limit: 10 },
    });
  });
  it('use graphql method', async () => {
    initFileProvider();
    const mockedEndpoints = await localServer.forPost('/graphql').thenReply(200);

    await sendHttp(`
GRAPHQL http://localhost:7002/graphql
Content-Type: application/json

query company_query {
  company {
    coo
  }
}
      `);

    const requests = await mockedEndpoints.getSeenRequests();
    expect(requests[0].url).toBe('http://localhost:7002/graphql');
    expect(await requests[0].body.getText()).toBe(
      '{"query":"query company_query {\\n  company {\\n    coo\\n  }\\n}","operationName":"company_query"}'
    );
  });
  it('imported buffer body with replace', async () => {
    const body = JSON.stringify({ foo: 'foo', bar: '{{bar}}' }, null, 2);
    initFileProvider({ 'body.json': body });
    const mockedEndpoints = await localServer.forPost('/post').thenReply(200);

    await sendHttp(`
@bar=bar2
POST http://localhost:7002/post
Content-Type: application/json

<@ ./body.json
      `);

    const requests = await mockedEndpoints.getSeenRequests();
    expect(requests[0].headers['content-type']).toBe('application/json');
    expect(await requests[0].body.getText()).toBe(JSON.stringify({ foo: 'foo', bar: 'bar2' }, null, 2));
  });
});
