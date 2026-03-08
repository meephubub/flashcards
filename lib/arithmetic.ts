export function evalArithmetic(expr: string): number | null {
    try {
        const tokens: (number | string)[] = []
        // Tokenize
        const s = expr.replace(/\s+/g, "")
        let i = 0
        while (i < s.length) {
            const ch = s[i]
            if (/[0-9.]/.test(ch)) {
                let j = i + 1
                while (j < s.length && /[0-9.]/.test(s[j])) j++
                const num = parseFloat(s.slice(i, j))
                if (Number.isNaN(num)) return null
                tokens.push(num)
                i = j
                continue
            }
            if (/[+\-*/^()]/.test(ch)) {
                // handle unary minus: if '-' and (start or previous is operator or '('), treat as 0 - x
                if (
                    ch === '-' &&
                    (tokens.length === 0 || typeof tokens[tokens.length - 1] === 'string' && (tokens[tokens.length - 1] as string).match(/[+\-*/^(]/))
                ) {
                    // push 0 and '-' as binary
                    tokens.push(0)
                    tokens.push('-')
                    i++
                    continue
                }
                tokens.push(ch)
                i++
                continue
            }
            return null
        }

        // Shunting-yard to RPN
        const out: (number | string)[] = []
        const ops: string[] = []
        const prec: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '^': 3 }
        const rightAssoc: Record<string, boolean> = { '^': true }

        for (const t of tokens) {
            if (typeof t === 'number') out.push(t)
            else if (t === '(') ops.push(t)
            else if (t === ')') {
                while (ops.length && ops[ops.length - 1] !== '(') out.push(ops.pop() as string)
                if (!ops.length) return null
                ops.pop() // remove '('
            } else {
                while (
                    ops.length &&
                    ops[ops.length - 1] !== '(' &&
                    (prec[ops[ops.length - 1]] > prec[t] || (prec[ops[ops.length - 1]] === prec[t] && !rightAssoc[t]))
                ) {
                    out.push(ops.pop() as string)
                }
                ops.push(t)
            }
        }
        while (ops.length) {
            const op = ops.pop() as string
            if (op === '(' || op === ')') return null
            out.push(op)
        }

        // Evaluate RPN
        const st: number[] = []
        for (const t of out) {
            if (typeof t === 'number') st.push(t)
            else {
                const b = st.pop(); const a = st.pop()
                if (a === undefined || b === undefined) return null
                switch (t) {
                    case '+': st.push(a + b); break
                    case '-': st.push(a - b); break
                    case '*': st.push(a * b); break
                    case '/': st.push(b === 0 ? NaN : a / b); break
                    case '^': st.push(Math.pow(a, b)); break
                    default: return null
                }
            }
        }
        if (st.length !== 1) return null
        const val = st[0]
        return Number.isFinite(val) ? val : null
    } catch {
        return null
    }
}
