import { CassandraRepository, MongoMongooseRepository } from '../../src';

/**
 * The repositories against real servers (Requirement 112 §1, JUM-602).
 *
 * The package's own unit suite reaches 87.4%. The headline figure said 100%,
 * but that number borrowed from the backend application's tests landing in the
 * same report — the milder version of exactly what Requirement 112 exists to
 * end, because a reader comparing packages was comparing unlike things.
 *
 * What the unit suite cannot reach is everything that needs a server to answer:
 * a connection that fails for one specific reason and then succeeds, and the
 * assignment that only happens after a real handshake. Those are here, measured
 * against containers rather than described.
 *
 * `RUN_DB_REPOSITORIES_INTEGRATION=1` with the containers from
 * `docker-compose-cassandra.yml` and `docker-compose-mongodb.yml`.
 */

/**
 * Reaches the connection state the repositories keep protected.
 *
 * The same shape the unit suite uses. `connected` is `protected` and `client`
 * is `private`, and they are the only record of what actually happened — a test
 * that cannot see them can only assert that nothing threw, which is exactly the
 * kind of assertion this file exists to replace.
 */
const state = (repository: object) => repository as unknown as {
  connected: boolean;
  client: { execute(cql: string, params?: unknown[]): Promise<{ rows: unknown[] }> } | null;
  connection: { readyState: number } | null;
};

const RUNNING = process.env.RUN_DB_REPOSITORIES_INTEGRATION === '1';

/**
 * Skipped, not passed, when the servers are absent.
 *
 * A suite that reports success without the thing it tests is the false green
 * this repository keeps finding, and this file exists because of one.
 */
const suite = RUNNING ? describe : describe.skip;

const CASSANDRA_HOST = process.env.JUMENTIX_CASSANDRA_HOST || '127.0.0.1';
const MONGO_URL = process.env.JUMENTIX_MONGO_URL || 'mongodb://127.0.0.1:27027';

/** A keyspace no other run of this suite will use. */
const uniqueKeyspace = () => `jum602_${Date.now().toString(36)}`.toLowerCase();

suite('the Cassandra repository against a real cluster', () => {
  const opened: CassandraRepository[] = [];

  afterAll(async () => {
    for (const repository of opened) {
      // eslint-disable-next-line no-await-in-loop
      await repository.disconnect().catch(() => undefined);
    }
  }, 120000);

  /**
   * The keyspace auto-create retry, which is the largest thing the unit suite
   * cannot see.
   *
   * Connecting to a keyspace that does not exist fails with a message naming
   * it; the repository then opens a second, keyspace-less client, creates it,
   * and reconnects. Every step of that needs a cluster that actually refuses
   * the first attempt — a substitute would only prove the code calls the
   * functions the substitute was told to expect.
   */
  it('creates a missing keyspace and connects to it', async () => {
    expect.hasAssertions();

    const keyspace = uniqueKeyspace();
    const repository = new CassandraRepository({
      database: keyspace,
      extra: { contactPoints: [CASSANDRA_HOST], localDataCenter: 'datacenter1' }
    });
    opened.push(repository);

    await repository.connect();

    expect(state(repository).connected).toBe(true);

    // Asked of the cluster, not of the repository: the keyspace has to exist
    // on the server for this to answer, which is the whole claim.
    const { client } = state(repository);

    expect(client).not.toBeNull();

    const result = await client!.execute(
      'SELECT keyspace_name FROM system_schema.keyspaces WHERE keyspace_name = ?',
      [keyspace]
    );

    expect(result.rows).toHaveLength(1);
  }, 120000);

  it('connects to a keyspace that already exists without recreating it', async () => {
    expect.hasAssertions();

    const keyspace = uniqueKeyspace();
    const first = new CassandraRepository({
      database: keyspace,
      extra: { contactPoints: [CASSANDRA_HOST], localDataCenter: 'datacenter1' }
    });
    await first.connect();
    await first.disconnect();

    // The second connect takes the path where nothing throws, which is the
    // branch the retry test does not exercise.
    const second = new CassandraRepository({
      database: keyspace,
      extra: { contactPoints: [CASSANDRA_HOST], localDataCenter: 'datacenter1' }
    });
    opened.push(second);

    await second.connect();

    expect(state(second).connected).toBe(true);
  }, 120000);

  /**
   * A failure that is *not* about a keyspace must propagate rather than be
   * swallowed by the retry. Otherwise a wrong data centre would be reported as
   * a keyspace problem, and the retry would fail for a second, unrelated
   * reason that hides the first.
   */
  it('rethrows a connection failure that is not about the keyspace', async () => {
    expect.hasAssertions();

    const repository = new CassandraRepository({
      database: uniqueKeyspace(),
      extra: { contactPoints: [CASSANDRA_HOST], localDataCenter: 'no-such-datacenter' }
    });

    // The message is asserted, not just the throw: a keyspace-shaped failure
    // here would mean the retry swallowed the real cause and this test would
    // pass for the wrong reason.
    await expect(repository.connect()).rejects.toThrow(/datacenter|data center|no-such/i);
    expect(state(repository).connected).toBe(false);
  }, 120000);

  it('shuts the client down and reports the new state', async () => {
    expect.hasAssertions();

    const repository = new CassandraRepository({
      database: uniqueKeyspace(),
      extra: { contactPoints: [CASSANDRA_HOST], localDataCenter: 'datacenter1' }
    });
    await repository.connect();

    await repository.disconnect();

    expect(state(repository).connected).toBe(false);
    expect(state(repository).client).toBeNull();
  }, 120000);
});

suite('the Mongo repository against a real server', () => {
  let repository: MongoMongooseRepository;

  afterEach(async () => {
    await repository?.disconnect().catch(() => undefined);
  }, 60000);

  /**
   * The line the unit suite cannot reach: `this.connection` is assigned from
   * the object mongoose returns *after* a successful handshake. Until a server
   * answers there is nothing to assign.
   */
  it('holds the live connection after connecting', async () => {
    expect.hasAssertions();

    repository = new MongoMongooseRepository({
      connectionUrl: MONGO_URL,
      database: `jum602_${Date.now().toString(36)}`
    });

    await repository.connect();

    expect(state(repository).connected).toBe(true);
    const { connection } = state(repository);

    expect(connection).not.toBeNull();
    // 1 is mongoose's "connected" ready state. Asserted rather than trusting
    // the flag the repository sets itself.
    expect(connection!.readyState).toBe(1);
  }, 60000);

  it('disconnects and drops the connection it was holding', async () => {
    expect.hasAssertions();

    repository = new MongoMongooseRepository({
      connectionUrl: MONGO_URL,
      database: `jum602_${Date.now().toString(36)}`
    });
    await repository.connect();

    await repository.disconnect();

    expect(state(repository).connected).toBe(false);
    expect(state(repository).connection).toBeNull();
  }, 60000);

  it('reports a connection it cannot make rather than reporting success', async () => {
    expect.hasAssertions();

    repository = new MongoMongooseRepository({
      connectionUrl: 'mongodb://127.0.0.1:59999',
      database: 'unreachable',
      extra: { serverSelectionTimeoutMS: 2000 }
    });

    await expect(repository.connect()).rejects.toThrow(/ECONNREFUSED|connect|server selection/i);
    expect(state(repository).connected).toBe(false);
  }, 60000);
});
