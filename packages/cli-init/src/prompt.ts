import readline from 'node:readline';
import type { Readable, Writable } from 'node:stream';

export type Prompt = {
  ask: (question: string) => Promise<string>;
  confirm: (question: string, defaultYes?: boolean) => Promise<boolean>;
  select: <T extends string>(
    question: string,
    choices: Array<{ id: T; label: string }>
  ) => Promise<T>;
  close: () => void;
};

/**
 * readline over injectable streams — no heavy TUI dependency (Req 037 / JUM-844).
 */
export function createPrompt({
  input = process.stdin,
  output = process.stdout
}: {
  input?: Readable;
  output?: Writable;
} = {}): Prompt {
  const rl = readline.createInterface({
    input: input as any,
    output: output as any
  });

  const ask = (question: string): Promise<string> => new Promise((resolve) => {
    rl.question(question, (answer) => resolve(String(answer || '').trim()));
  });

  const confirm = async (question: string, defaultYes = true): Promise<boolean> => {
    const hint = defaultYes ? 'Y/n' : 'y/N';
    const answer = (await ask(`${question} (${hint}): `)).toLowerCase();
    if (!answer) return defaultYes;
    return answer === 'y' || answer === 'yes';
  };

  const select = async <T extends string>(
    question: string,
    choices: Array<{ id: T; label: string }>
  ): Promise<T> => {
    if (choices.length === 0) {
      throw new Error('select requires at least one choice.');
    }
    // eslint-disable-next-line no-console
    console.log(`\n${question}`);
    choices.forEach((choice, index) => {
      // eslint-disable-next-line no-console
      console.log(` ${index + 1}. ${choice.label}`);
    });
    const selected = await ask('Type number: ');
    const index = Number(selected) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= choices.length) {
      throw new Error(`Invalid selection "${selected}".`);
    }
    return choices[index].id;
  };

  return {
    ask,
    confirm,
    select,
    close: () => rl.close()
  };
}
