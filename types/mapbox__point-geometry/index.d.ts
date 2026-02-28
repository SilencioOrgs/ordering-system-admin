declare module "@mapbox/point-geometry" {
  class Point {
    constructor(x: number, y: number);
    x: number;
    y: number;
  }

  export default Point;
}

declare module "mapbox__point-geometry" {
  import Point from "@mapbox/point-geometry";
  export = Point;
}
