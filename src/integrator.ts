export class NumericalIntegrator {
  /**
   * Evaluates the definite integral of a function f from a to b using Simpson's 1/3 rule.
   * Standard Simpson's 1/3 rule formula:
   * Integral ≈ (h / 3) * [f(x_0) + f(x_n) + 4 * sum(f(x_odd)) + 2 * sum(f(x_even))]
   * 
   * @param f The function to integrate. The parameter passed is a Date object.
   * @param a The start Date/time of integration.
   * @param b The end Date/time of integration.
   * @param n Number of subintervals. Must be an even number. If odd, it will be increased by 1.
   * @returns Integrated value in units of "f-unit * hours" (since time steps are computed in hours).
   */
  public static simpson_1_3(
    f: (t: Date) => number,
    a: Date,
    b: Date,
    n: number
  ): number {
    const tMin = a.getTime();
    const tMax = b.getTime();
    
    // Bounds check
    if (tMin >= tMax) return 0;
    
    // Ensure n is even
    let intervals = Math.floor(n);
    if (intervals % 2 !== 0) {
      intervals += 1;
    }
    if (intervals <= 0) intervals = 2;

    const durationHrs = (tMax - tMin) / 3600000; // time span in hours
    const h = durationHrs / intervals; // step size in hours
    
    let sum = f(a) + f(b);

    for (let i = 1; i < intervals; i++) {
      const tVal = tMin + i * (tMax - tMin) / intervals;
      const tDate = new Date(tVal);
      const coeff = i % 2 === 0 ? 2 : 4;
      sum += coeff * f(tDate);
    }

    return (h / 3) * sum;
  }
}
