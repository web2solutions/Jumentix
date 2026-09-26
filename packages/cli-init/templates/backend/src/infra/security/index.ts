import xss from 'xss';

class Security {
  public static xss(str: string): string {
    return xss(str);
  }
}

export default Security;
