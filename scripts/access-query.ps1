param(
  [Parameter(Mandatory = $true)] [string] $DatabasePath,
  [Parameter(Mandatory = $true)] [string] $Query
)

$ErrorActionPreference = 'Stop'

$connection = New-Object System.Data.Odbc.OdbcConnection(
  'Driver={Microsoft Access Driver (*.mdb)};Dbq=' + $DatabasePath + ';'
)

try {
  $connection.Open()
  $adapter = New-Object System.Data.Odbc.OdbcDataAdapter($Query, $connection)
  $table = New-Object System.Data.DataTable
  [void] $adapter.Fill($table)

  $rows = @()
  foreach ($row in $table.Rows) {
    $item = [ordered]@{}
    foreach ($column in $table.Columns) {
      $value = $row[$column.ColumnName]
      if ($value -is [System.DBNull]) {
        $item[$column.ColumnName] = $null
      }
      else {
        $item[$column.ColumnName] = $value
      }
    }
    $rows += [pscustomobject]$item
  }

  $rows | ConvertTo-Json -Depth 8 -Compress
}
finally {
  if ($connection.State -eq [System.Data.ConnectionState]::Open) {
    $connection.Close()
  }
}
