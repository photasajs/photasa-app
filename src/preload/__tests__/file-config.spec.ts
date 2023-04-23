import { getPhotasaConfig } from "../file-config";
import { vol } from "memfs";

jest.mock("fs");
jest.mock("fs/promises");
