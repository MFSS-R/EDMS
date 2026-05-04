import { useMemo } from 'react'
import Plot from 'react-plotly.js'

function formatAxisName(label, unit) {
  if (!label) return ''
  return unit ? `${label} (${unit})` : label
}

function isGridSeries(seriesItem) {
  return !!(
    seriesItem
    && (
      seriesItem.format === 'grid'
      || (
        Array.isArray(seriesItem.x_values)
        && Array.isArray(seriesItem.y_values)
        && Array.isArray(seriesItem.z_matrix)
      )
    )
  )
}

function buildPointsFromGrid(seriesItem) {
  const xValues = seriesItem.x_values || []
  const yValues = seriesItem.y_values || []
  const zMatrix = seriesItem.z_matrix || []
  const points = []

  yValues.forEach((yValue, yIndex) => {
    const row = zMatrix[yIndex] || []
    xValues.forEach((xValue, xIndex) => {
      const zValue = row[xIndex]
      if (zValue !== null && zValue !== undefined) {
        points.push([xValue, yValue, zValue])
      }
    })
  })

  return points
}

function normalizePlotData(plotData) {
  if (!plotData) return null

  if (plotData.series && plotData.series.length > 0) {
    return {
      dimensions: plotData.dimensions,
      x_column: plotData.x_column || 'X',
      x_unit: plotData.x_unit || '',
      y_column: plotData.y_column || '',
      y_unit: plotData.y_unit || '',
      series: plotData.series,
    }
  }

  if (plotData.columns && plotData.data) {
    const { columns, data, dimensions = 2 } = plotData
    const x_column = columns[0]
    const series = []
    for (let i = 1; i < columns.length; i += 1) {
      const seriesData = data
        .filter((row) => row.length > i)
        .map((row) => [row[0], row[i]])
      series.push({ name: columns[i], data: seriesData })
    }
    return {
      dimensions,
      x_column,
      x_unit: plotData.x_unit || '',
      y_column: plotData.y_column || '',
      y_unit: plotData.y_unit || '',
      series,
    }
  }

  return null
}

function buildHeatmapTrace({ xValues, yValues, zMatrix, xAxisName, yAxisName, name }) {
  return {
    type: 'heatmap',
    name,
    z: zMatrix,
    x: xValues,
    y: yValues,
    colorscale: 'Viridis',
    showscale: true,
    text: zMatrix.map((row, yi) =>
      row.map((value, xi) =>
        value !== null && value !== undefined
          ? `${xAxisName}: ${xValues[xi]}<br>${yAxisName}: ${yValues[yi]}<br>Z: ${value}`
          : ''
      )
    ),
    hoverinfo: 'text',
  }
}

function buildScatter3dTrace(seriesItem, points, useScale = false) {
  const zData = points.map((point) => point[2])

  return {
    type: 'scatter3d',
    mode: 'markers',
    name: seriesItem.name,
    x: points.map((point) => point[0]),
    y: points.map((point) => point[1]),
    z: zData,
    marker: {
      size: 4,
      color: useScale ? zData : undefined,
      colorscale: useScale ? 'Viridis' : undefined,
      showscale: useScale,
    },
  }
}

export default function DataChart({ plotData, height = 400, title }) {
  const normalized = useMemo(() => normalizePlotData(plotData), [plotData])

  const { traces, layout } = useMemo(() => {
    if (!normalized || !normalized.series || normalized.series.length === 0) {
      return { traces: [], layout: {} }
    }

    const { dimensions, x_column, x_unit, y_column, y_unit, series } = normalized

    const xAxisName = formatAxisName(x_column, x_unit)
    const yAxisLabel = y_column || (series.length === 1 ? series[0].name : '')
    const yAxisName = formatAxisName(yAxisLabel, y_unit)

    const baseLayout = {
      title: {
        text: title || '',
        x: 0.5,
        font: { size: 16 },
      },
      margin: { l: 70, r: 30, t: title ? 50 : 30, b: 60 },
      showlegend: series.length > 1,
      legend: { orientation: 'h', y: -0.15 },
    }

    if (dimensions === 2) {
      const allXData = series.flatMap((seriesItem) => seriesItem.data.map((dataPoint) => dataPoint[0]))
      const isCategoryX = allXData.some((value) => typeof value === 'string')

      const plotlyTraces = series.map((seriesItem) => {
        const xData = seriesItem.data.map((dataPoint) => dataPoint[0])
        const yData = seriesItem.data.map((dataPoint) => dataPoint[1])
        const chartType = seriesItem.type || 'line'

        if (chartType === 'bar') {
          return {
            type: 'bar',
            name: seriesItem.name,
            x: xData,
            y: yData,
          }
        }

        if (chartType === 'scatter') {
          return {
            type: 'scatter',
            mode: 'markers',
            name: seriesItem.name,
            x: xData,
            y: yData,
            marker: { size: 8 },
          }
        }

        return {
          type: 'scatter',
          mode: 'lines+markers',
          name: seriesItem.name,
          x: xData,
          y: yData,
          line: { shape: 'spline', width: 2 },
          marker: { size: 5 },
          fill: series.length === 1 ? 'tozeroy' : undefined,
          fillcolor: series.length === 1 ? 'rgba(0,100,200,0.08)' : undefined,
        }
      })

      return {
        traces: plotlyTraces,
        layout: {
          ...baseLayout,
          xaxis: {
            title: { text: xAxisName, standoff: 10 },
            type: isCategoryX ? 'category' : 'linear',
          },
          yaxis: {
            title: { text: yAxisName, standoff: 10 },
          },
          dragmode: 'zoom',
        },
      }
    }

    if (dimensions === 3) {
      const sceneLayout = {
        xaxis: { title: { text: xAxisName } },
        yaxis: { title: { text: yAxisName } },
        zaxis: { title: { text: 'Z' } },
      }

      if (series.length === 1) {
        const seriesItem = series[0]

        if (isGridSeries(seriesItem)) {
          const xValues = seriesItem.x_values || []
          const yValues = seriesItem.y_values || []
          const zMatrix = seriesItem.z_matrix || []
          const isCategoryX = xValues.some((value) => typeof value === 'string')
          const isCategoryY = yValues.some((value) => typeof value === 'string')

          if (isCategoryX || isCategoryY) {
            return {
              traces: [
                buildHeatmapTrace({
                  xValues,
                  yValues,
                  zMatrix,
                  xAxisName,
                  yAxisName,
                  name: seriesItem.name,
                }),
              ],
              layout: {
                ...baseLayout,
                xaxis: { title: { text: xAxisName, standoff: 10 } },
                yaxis: { title: { text: yAxisName, standoff: 10 } },
              },
            }
          }

          return {
            traces: [{
              type: 'surface',
              name: seriesItem.name,
              x: xValues,
              y: yValues,
              z: zMatrix,
              colorscale: 'Viridis',
              showscale: true,
            }],
            layout: {
              ...baseLayout,
              scene: sceneLayout,
            },
          }
        }

        const points = seriesItem.data || []
        const xData = points.map((point) => point[0])
        const yData = points.map((point) => point[1])
        const isCategoryX = xData.some((value) => typeof value === 'string')
        const isCategoryY = yData.some((value) => typeof value === 'string')

        if (isCategoryX || isCategoryY) {
          const uniqueX = [...new Set(xData)]
          const uniqueY = [...new Set(yData)]
          const zMatrix = Array.from({ length: uniqueY.length }, () => Array(uniqueX.length).fill(null))

          points.forEach((point) => {
            const xi = uniqueX.indexOf(point[0])
            const yi = uniqueY.indexOf(point[1])
            if (xi >= 0 && yi >= 0) {
              zMatrix[yi][xi] = point[2]
            }
          })

          return {
            traces: [
              buildHeatmapTrace({
                xValues: uniqueX,
                yValues: uniqueY,
                zMatrix,
                xAxisName,
                yAxisName,
                name: seriesItem.name,
              }),
            ],
            layout: {
              ...baseLayout,
              xaxis: { title: { text: xAxisName, standoff: 10 } },
              yaxis: { title: { text: yAxisName, standoff: 10 } },
            },
          }
        }

        return {
          traces: [buildScatter3dTrace(seriesItem, points, true)],
          layout: {
            ...baseLayout,
            scene: sceneLayout,
          },
        }
      }

      const multi3dTraces = series.map((seriesItem, index) => {
        if (isGridSeries(seriesItem)) {
          const xValues = seriesItem.x_values || []
          const yValues = seriesItem.y_values || []
          const zMatrix = seriesItem.z_matrix || []
          const isCategoryX = xValues.some((value) => typeof value === 'string')
          const isCategoryY = yValues.some((value) => typeof value === 'string')

          if (isCategoryX || isCategoryY) {
            return buildScatter3dTrace(seriesItem, buildPointsFromGrid(seriesItem), index === 0)
          }

          return {
            type: 'surface',
            name: seriesItem.name,
            x: xValues,
            y: yValues,
            z: zMatrix,
            opacity: 0.82,
            colorscale: 'Viridis',
            showscale: index === 0,
          }
        }

        return buildScatter3dTrace(seriesItem, seriesItem.data || [], false)
      })

      return {
        traces: multi3dTraces,
        layout: {
          ...baseLayout,
          showlegend: true,
          scene: sceneLayout,
        },
      }
    }

    return { traces: [], layout: {} }
  }, [normalized, title])

  if (!normalized || !normalized.series || normalized.series.length === 0) {
    return null
  }

  return (
    <Plot
      data={traces}
      layout={{
        ...layout,
        autosize: true,
        height,
      }}
      useResizeHandler
      style={{ width: '100%', height: `${height}px` }}
      config={{
        responsive: true,
        displayModeBar: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
        displaylogo: false,
        toImageButtonOptions: {
          format: 'png',
          filename: 'chart',
          height: 800,
          width: 1200,
          scale: 2,
        },
      }}
    />
  )
}
