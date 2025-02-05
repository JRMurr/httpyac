import { send } from '../../httpYacApi';
import { initFileProvider, parseHttp } from '../testUtils';
import { getLocal } from 'mockttp';

describe('metadata.import', () => {
  const localServer = getLocal();
  beforeEach(() => localServer.start(8008));
  afterEach(() => localServer.stop());

  it('name + import + ref', async () => {
    initFileProvider({
      'import.http': `
# @name foo
GET  http://localhost:8008/json
      `,
    });
    await localServer.forGet('/json').thenJson(200, { foo: 'bar', test: 1 });
    const mockedEndpoints = await localServer.forPost('/post').thenReply(200);
    const httpFile = await parseHttp(`
# @import ./import.http
###
# @ref foo
POST http://localhost:8008/post?test={{foo.test}}

foo={{foo.foo}}
    `);

    await send({
      httpFile,
      httpRegion: httpFile.httpRegions[1],
    });

    const requests = await mockedEndpoints.getSeenRequests();
    expect(requests[0].url).toBe('http://localhost:8008/post?test=1');
    expect(await requests[0].body.getText()).toBe('foo=bar');
  });
  it('import global variable', async () => {
    initFileProvider({
      'import.http': `
@foo=bar
@bar=foo
      `,
    });
    await localServer.forGet('/json').thenJson(200, { foo: 'bar', test: 1 });
    const mockedEndpoints = await localServer.forPost('/post').thenReply(200);
    const httpFile = await parseHttp(`
# @import ./import.http
POST http://localhost:8008/post?foo={{foo}}

bar={{bar}}
    `);

    await send({
      httpFile,
      httpRegion: httpFile.httpRegions[1],
    });

    const requests = await mockedEndpoints.getSeenRequests();
    expect(requests[0].url).toBe('http://localhost:8008/post?foo=bar');
    expect(await requests[0].body.getText()).toBe('bar=foo');
  });
  it('import named variable', async () => {
    initFileProvider({
      'import.http': `
      ###
# @test
@foo=bar
@bar=foo
      `,
    });
    await localServer.forGet('/json').thenJson(200, { foo: 'bar', test: 1 });
    const mockedEndpoints = await localServer.forPost('/post').thenReply(200);
    const httpFile = await parseHttp(`
# @import ./import.http
# @ref test
POST http://localhost:8008/post?foo={{foo}}

bar={{bar}}
    `);

    await send({
      httpFile,
      httpRegion: httpFile.httpRegions[1],
    });

    const requests = await mockedEndpoints.getSeenRequests();
    expect(requests[0].url).toBe('http://localhost:8008/post?foo=bar');
    expect(await requests[0].body.getText()).toBe('bar=foo');
  });
  it('import request with using global host variable', async () => {
    initFileProvider({
      'import.http': `
      @host=http://localhost:8008

      ### Apple
      # @name send_apple
      POST /anything
      Content-Type: application/json

      {
              "id": "0001",
              "type": "fruit",
              "name": "Apple"
      }
      `,
    });
    await localServer.forGet('/json').thenJson(200, { foo: 'bar', test: 1 });
    const mockedEndpoints = await localServer.forPost('/anything').thenReply(200);
    const httpFile = await parseHttp(`
# @import ./import.http

###
# @forceRef send_apple
    `);

    await send({
      httpFile,
      httpRegion: httpFile.httpRegions[1],
    });

    const requests = await mockedEndpoints.getSeenRequests();
    expect(requests[0].url).toBe('http://localhost:8008/anything');
    expect(requests[0].headers['content-type']).toBe('application/json');
  });
});
