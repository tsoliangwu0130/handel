const accountConfig = require('../../lib/util/account-config')(`${__dirname}/../test-account-config.yml`).getAccountConfig();
const util = require('../../lib/util/util');
const sinon = require('sinon');
const expect = require('chai').expect;
const fs = require('fs');
const ServiceContext = require('../../lib/datatypes/service-context');

describe('util module', function() {
    let sandbox;

    beforeEach(function() {
        sandbox = sinon.sandbox.create();
    });

    afterEach(function() {
        sandbox.restore();
    });

    describe('readFileSync', function() {
        it('should return null on an error', function() {
            sandbox.stub(fs, 'readFileSync').throws(new Error("someMessage"));
            let result = util.readFileSync('somePath');
            expect(result).to.be.null;
        });

        it('should return the file contents on success', function() {
            sandbox.stub(fs, 'readFileSync').returns("");
            let result = util.readFileSync('somePath');
            expect(result).to.equal("");
        });
    });

    describe('readYamlFileSync', function() {
        it('should return null on an error', function() {
            sandbox.stub(fs, 'readFileSync').throws(new Error("someMessage"));
            let result = util.readYamlFileSync('somePath');
            expect(result).to.be.null;
        });

        it('should return the yaml object on success', function() {
            sandbox.stub(fs, 'readFileSync').returns("key: value");
            let result = util.readYamlFileSync('somePath');
            expect(result.key).to.equal("value");
        });
    });

    describe('readYamlFileAsync', function() {
        it('should return the yaml object on success', function() {
            sandbox.stub(fs, 'readFile').callsArgWith(2, null, "key: value");
            return util.readYamlFileAsync('somePath')
                .then(result => {
                    expect(result.key).to.equal("value");
                });
        })

        it('should return a rejected promise on error', function() {
            sandbox.stub(fs, 'readFile').callsArgWith(2, new Error("error"), null);
            return util.readYamlFileAsync('somePath')
                .then(result => {
                    expect(true).to.be.false; //Should not get here
                })
                .catch(err => {
                    expect(err.message).to.equal("error");
                });
        });
    });

    describe('zipDirectoryToFile', function() {
        let zippedPath = `${__dirname}/zipped-test-file.zip`;

        afterEach(function() {
            if(fs.existsSync(zippedPath)) {
                fs.unlinkSync(zippedPath); //Ensure created ZIP archive gets deleted
            }
        });

        it('should zip the given directory if it exists', function() {
            return util.zipDirectoryToFile(__dirname, zippedPath)
                .then(() => {
                    expect(fs.existsSync(zippedPath)).to.be.true;
                });
        });

        it('should throw an error if the given directory doesnt exist', function() {
            return util.zipDirectoryToFile('${__dirname}/myfakedir/', zippedPath)
                .then(() => {
                    expect(true).to.be.false; //Should not get here
                })
                .catch(err => {
                    expect(err.message).to.contain('Directory path to be zipped does not exist');
                });
        });
    });
})