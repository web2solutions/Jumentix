import { v4 as uuidv4, parse, stringify } from 'uuid';

export function createUuid(): string {
  return uuidv4();
}

export class UUID {
  private readonly uuid: string;

  private constructor(id?: string) {
    try {
      if (id) {
        this.uuid = stringify(parse(id));
      } else {
        this.uuid = createUuid();
      }
    } catch (error) {
      throw new Error('Invalid UUID');
    }
  }

  public static create(): UUID {
    return new this();
  }

  public static parse(uuid: string): UUID {
    return new this(uuid);
  }

  public toString(): string {
    return this.uuid;
  }
}
