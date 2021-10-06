export class Perlin {
    static gradients = new Map<string, {x: number, y: number}>()
    static memory = new Map<string, number>()

    static randVect() {
        let theta = Math.random() * 2 * Math.PI;
        return {x: Math.cos(theta), y: Math.sin(theta)};
    }

    static dotProdGrid(x: number, y: number, vx: number, vy: number) {
        let g_vect;
        let d_vect = {x: x - vx, y: y - vy};
        if (Perlin.gradients.get([vx,vy].toString())) {
            g_vect = Perlin.gradients.get([vx,vy].toString());
        } else {
            g_vect = Perlin.randVect();
            Perlin.gradients.set([vx, vy].toString(), g_vect);
        }
        return d_vect.x * g_vect.x + d_vect.y * g_vect.y;
    }

    static smootherstep(x: number){
        return 6*x**5 - 15*x**4 + 10*x**3;
    }

    static interp(x: number, a: number, b: number){
        return a + Perlin.smootherstep(x) * (b-a);
    }

    static get(x: number, y: number) {
        if (Perlin.memory.get([x,y].toString()))
            return Perlin.memory.get([x,y].toString());
        let xf = Math.floor(x);
        let yf = Math.floor(y);
        //interpolate
        let tl = Perlin.dotProdGrid(x, y, xf,   yf);
        let tr = Perlin.dotProdGrid(x, y, xf+1, yf);
        let bl = Perlin.dotProdGrid(x, y, xf,   yf+1);
        let br = Perlin.dotProdGrid(x, y, xf+1, yf+1);
        let xt = Perlin.interp(x-xf, tl, tr);
        let xb = Perlin.interp(x-xf, bl, br);
        let v = Perlin.interp(y-yf, xt, xb);
        Perlin.memory.set([x,y].toString(), v);
        return v;
    }
}