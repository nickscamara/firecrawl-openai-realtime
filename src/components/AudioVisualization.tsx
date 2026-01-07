interface AudioVisualizationProps {
  clientCanvasRef: React.RefObject<HTMLCanvasElement>;
  serverCanvasRef: React.RefObject<HTMLCanvasElement>;
}

export const AudioVisualization = ({
  clientCanvasRef,
  serverCanvasRef,
}: AudioVisualizationProps) => {
  return (
    <div className="visualization">
      <div className="visualization-entry client">
        <canvas ref={clientCanvasRef} />
      </div>
      <div className="visualization-entry server">
        <canvas ref={serverCanvasRef} />
      </div>
    </div>
  );
};
