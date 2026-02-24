import React from "react";
import { Box } from "@mui/material";

const SIZE = 9;

const Hex = ({ color = "#e8e2d6" }) => {
  return (
    <Box
      sx={{
        width: 60,
        height: 70,
        backgroundColor: color,
        margin: "4px",
        clipPath: `polygon(
          50% 0%, 
          100% 25%, 
          100% 75%, 
          50% 100%, 
          0% 75%, 
          0% 25%
        )`,
        transition: "0.2s",
        "&:hover": {
          backgroundColor: "#4da6ff",
          cursor: "pointer",
        },
      }}
    />
  );
};

const TriangularBoard = () => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        mt: 4,
      }}
    >
      {Array.from({ length: SIZE }).map((_, row) => (
        <Box
          key={row}
          sx={{
            display: "flex",
            justifyContent: "center",
            mb: "-15px",
          }}
        >
          {Array.from({ length: row + 1 }).map((_, col) => (
            <Hex key={`${row}-${col}`} />
          ))}
        </Box>
      ))}
    </Box>
  );
};

export default TriangularBoard;