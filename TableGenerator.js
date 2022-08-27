//TODO: Need to change how the column headers work. Need to allow no column headers
//TODO: Need to find a way to separate the table into parts. When printing the table, it can only be 2000 characters long
//TODO: Add a way to pad right or pad left when formatting the column
class TableGenerator {
    constructor() {
        this.separatorSymbol = '='
        this.tableBorder = '|'
        this.MAX_COLUMN_WIDTH = 100
        this.tableName = ''

        this.allRows = []
        this.columnHeaders = []
        this.rowData = []
        this.columnSizes = new Map()
        this.fullTable = '';
        this.useRowSeparator = false
    }
    //builds the table and prints it
     printTable() {
        this.buildFullTable()
         if(this.tableName !== undefined || this.tableName !== ''){
             console.log('Table: ' + this.tableName)
         }
         console.log('Record count: ' + this.getRecordCount() + ' Column Count: ' + this.getColumnCount())
        console.log(this.fullTable)
    }
    //returns the full table
    getTable(){
        return this.fullTable
    }
    //Since this uses a spread operator you can just pass in many string names for the column names
     addColumns(...p_columnNames){
        p_columnNames.forEach( columnName => {
            this.columnHeaders.push(columnName)
        })
    }
    //adds a single row of data to the table
     addRow(p_rowData){
        if(p_rowData.length > this.columnHeaders.length){
            throw 'Row data has too many elements in the row: ' + p_rowData
        }
        this.rowData.push(p_rowData)
    }
    //adds a list of rows to the table
     addRows(...p_rowData){
        p_rowData.forEach( row => this.addRow(row))
    }
    //Removes a row at a given index
    removeRow(index){
        console.log('Removing record: ' + this.rowData[index])
        this.rowData.splice(index, 1)
    }
    //Calls all the parts of the table and adds them to a list of lines to be displayed.
     buildFullTable(){
        this.allRows = []
        this.initializeColumnSizeMap();
        this.buildSeparator();
        this.buildHeader();
        this.buildSeparator();
        this.buildRows();
        this.buildTable();
    }
    //Sets the sizes of the columns. If any of the columns exceed the max column size, then set the column size to the max column size.
     initializeColumnSizeMap() {
        for(let i = 0; i < this.columnHeaders.length; i++){
            this.columnSizes.set(this.columnHeaders[i], this.columnHeaders[i].length)
        }
        for (let i = 0; i < this.rowData.length; i++) {
            for(let j = 0; j < this.rowData[i].length; j++){
                let rowSize = this.columnSizes.get(this.columnHeaders[j])
                if(this.rowData[i][j].length >= this.MAX_COLUMN_WIDTH){
                    this.columnSizes.set(this.columnHeaders[j], this.MAX_COLUMN_WIDTH)
                }
                else if(this.rowData[i][j].length > rowSize){
                    this.columnSizes.set(this.columnHeaders[j], this.rowData[i][j].length)
                }
            }
        }
    }

    //Adds a separator line to the table
     buildSeparator(){
        let line = this.tableBorder;
        for(let i = 0; i < this.columnHeaders.length; i++){
            for(let j = 0; j < this.columnSizes.get(this.columnHeaders[i]) + 2; j++){
                line += this.separatorSymbol
            }
            line += this.tableBorder
        }
        this.allRows.push(line)
    }
    //Returns the biggest number from the chunk sizes to set how many extra rows will be needed.
     getMaxChunkSize(row) {
        let chunkMap = new Map()
        for(let i = 0; i < row.length; i++){
            let chunkSize = this.chunkText(row[i]).length
            if(chunkSize > 0){
                chunkMap.set(i, chunkSize)
            }
        }
        return Math.max(...chunkMap.values());
    }
    //Formats the rows and adds them to the table
     buildRows() {
        let line;
        //For all the rows that will be inside the table...
        for (let i = 0; i < this.rowData.length; i++) {
            //Start the line formatting
            line = this.tableBorder
            let rowChunkSize = this.getMaxChunkSize(this.rowData[i])
            //If the column needs to be split up into rows...
            if(rowChunkSize > 1) {
                //This index will be used to grab the saw row number element from the chunked line.
                let index = 0;
                //Need to make a line for each extra row
                for(let k = 0; k < rowChunkSize; k++) {
                    //For each element in the row...
                    for (let j = 0; j < this.columnHeaders.length; j++) {
                        let chunkedLine = ''
                        if(this.rowData[i][j] !== undefined){
                            chunkedLine = this.chunkText(this.rowData[i][j])
                        }
                        let text = ''
                        if(chunkedLine[index] !== undefined) {
                            text = chunkedLine[index]
                        }
                        line += ' ' + this.formatColumn(text, this.columnSizes.get(this.columnHeaders[j]), ' ') + ' ' + this.tableBorder
                    }
                    //Increase the extra row index, push the extra row, start the line formatting again
                    index++
                    this.allRows.push(line)
                    line = this.tableBorder
                }
            }
            //Else handle the row normally without needing to split it into multiple rows
            else {
                for (let j = 0; j < this.columnHeaders.length; j++) {
                    let text = ''
                    if(this.rowData[i][j] !== undefined){
                        text = this.rowData[i][j]
                    }
                    line += ' ' + this.formatColumn(text, this.columnSizes.get(this.columnHeaders[j]), ' ') + ' ' + this.tableBorder
                }
                this.allRows.push(line)
            }
            // //Add a separator to the end of each the row
            if(this.useRowSeparator) {
                this.buildSeparator()
            }
        }
         this.buildSeparator()
    }
    //Builds the column headers for the table
     buildHeader(){
        let line = this.tableBorder;
        for(let i = 0; i < this.columnHeaders.length; i++){
            line += ' ' + this.formatColumn(this.columnHeaders[i], this.columnSizes.get(this.columnHeaders[i]), ' ') + ' ' + this.tableBorder
        }
        this.allRows.push(line)
    }
    //adds the last line to the table if needed
     buildFooter(){
        let line = '|';
        for(let i = 0; i < this.columnHeaders.length; i++){
            for(let j = 0; j < this.columnSizes.get(this.columnHeaders[i]) + 2; j++){
                line += this.separatorSymbol
            }
            line += this.tableBorder
        }
        this.allRows.push(line)
    }
    //Takes all the lines and prints them out
     buildTable(){
         let table = '';
         for(let i = 0; i < this.allRows.length; i++){
            table += this.allRows[i]
            if(i !== this.allRows.length - 1){
                table += '\n'
            }
        }
          this.fullTable = table
    }
    //Formats a string to be a certain size. If the text does not fill in the column size, fill in the extra spots with empty space.
     formatColumn(string, columnSize, padding){
        return String(string).padEnd(columnSize, padding);
    }
    //Chops a column's text into parts based on the max column size that will be used for each extra row.
     chunkText(str) {
        const array = []
        let indexStart = 0;
        for(let i = 0; i < str.length; i++){
            if(i % this.MAX_COLUMN_WIDTH === 0){
                array.push(str.substring(indexStart * this.MAX_COLUMN_WIDTH, (indexStart * this.MAX_COLUMN_WIDTH) + this.MAX_COLUMN_WIDTH))
                indexStart++
            }
        }
        return array;
    }
    //sets the symbol used for the horizontal line separator
    setSeparatorSymbol(symbol){
        if(symbol.length > 1 || symbol.length === 0){
            throw 'Separator symbol must be 1 character long'
        }
        this.separatorSymbol = symbol
    }
    //sets the symbol used for the vertical line border and separator
    setTableBorder(symbol){
        if(symbol.length > 1 || symbol.length === 0){
            throw 'Table border must be 1 character long'
        }
        this.tableBorder = symbol
    }
    //sets the width size of the columns
    setTableMaxColumnWidth(size){
        this.MAX_COLUMN_WIDTH = size
    }
    //sets the name of the table
    setTableName(p_strName){
        this.tableName = p_strName
    }
    //gets the number of records
    getRecordCount(){
        return this.rowData.length
    }
    //gets the number of column
    getColumnCount(){
        return this.columnHeaders.length
    }
    //Should the table be generated with the separator after each row?
    setUseSeparator(bool){
        this.useRowSeparator = bool
    }
    //resets the table to a blank slate
    resetTable() {
        this.allRows = []
        this.fullTable = '';
    }
    //Add info to the table by a given column name and row index
    addRowInfoFromColumnName(p_strColumnName, p_iIndex, p_value){
        this.rowData[p_iIndex][this.columnHeaders.indexOf(p_strColumnName)] = p_value
    }
    //Remove record field at a given column name and row index
    removeRowInfoFromColumnName(p_strColumnName, p_iIndex){
        this.rowData[p_iIndex][this.columnHeaders.indexOf(p_strColumnName)] = ''
    }
}

// ============================
//     TableGenerator Demo
// ============================

//doDemo()
function doDemo() {
    //Make a new table
    let table = new TableGenerator()
    table.setTableName('Demo Table')
    //Column names can be added in a list but each table row had to be an array of elements
    table.addColumns('ID', 'NAME')
    table.addRow(['232', 'TOM'])
    table.addRows(['4242', 'Person'], ['eewef', 'Another person'])
    //set the properties before calling the table
    table.setTableBorder('|')
    table.setSeparatorSymbol('=')
    //Print the table
    table.printTable()

    console.log('\nAdding another column and row')
    table.addColumns('New Column')
    table.addRow(['t', 't', '3rd Column'])
    table.printTable()

    console.log('\nResetting the table and using a different symbol set')

    //Just showing you can reset the table
    table.resetTable()
    table.setTableName('Updated Table')
    table.addColumns('New Col1', 'New Col2', 'New Col3')
    table.addRow(['Item in column 1 is long', 'Item in column 2 is even longer than 1', 'Item in column 3 is even longer than and longer than 2'])
    table.addRow(['232', 'TOM'])
    table.addRow(['232', 'TOM', 'Copy from the above record', 'More info', '', 'More info again'])
    table.removeRow(1)
    table.setSeparatorSymbol('+')
    table.setTableBorder('/')
    table.setTableMaxColumnWidth(10)
    table.printTable()

    console.log('\nNew table with set column data')

    table.addRowInfoFromColumnName('ID', 2, '45')
    table.removeRowInfoFromColumnName('NAME', 0)
    table.printTable()
}

module.exports = TableGenerator;